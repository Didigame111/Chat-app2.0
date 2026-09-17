import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  increment,
  limit,
  limitToLast,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  startAt,
  endAt,
  updateDoc,
  where,
  writeBatch,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from '../firebase';
import type { Chat, Message, Profile } from './types';

/** How many messages of history the chat pane keeps live. */
const MESSAGE_WINDOW = 250;

/** A typing flag older than this is treated as "stopped typing". */
export const TYPING_TTL_MS = 6000;

/**
 * Someone is "online" if their heartbeat landed within this window. It must be
 * comfortably wider than PRESENCE_INTERVAL_MS, or a beat arriving slightly
 * late makes an active person flicker offline.
 */
export const PRESENCE_TTL_MS = 360_000;

/**
 * Both people must derive the same conversation id without a lookup, so it is
 * the two uids sorted and joined. firestore.rules enforces the same shape.
 */
export function chatIdFor(a: string, b: string): string {
  return [a, b].sort().join('_');
}

export function hueFor(seed: string): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) % 360;
  }
  return hash;
}

// ------------------------------------------------------------------ profiles

export async function createProfile(uid: string, username: string): Promise<Profile> {
  const profile = {
    uid,
    username: username.trim(),
    usernameLower: username.trim().toLowerCase(),
    hue: hueFor(username.trim().toLowerCase()),
    createdAt: serverTimestamp(),
    lastSeen: Date.now(),
  };
  await setDoc(doc(db(), 'users', uid), profile);
  return { ...profile, createdAt: null } as Profile;
}

export async function getProfile(uid: string): Promise<Profile | null> {
  const snap = await getDoc(doc(db(), 'users', uid));
  return snap.exists() ? (snap.data() as Profile) : null;
}

export function touchPresence(uid: string): Promise<void> {
  return updateDoc(doc(db(), 'users', uid), { lastSeen: Date.now() }).catch(() => undefined);
}

/**
 * Prefix search on the lowercase username. Firestore's automatic single-field
 * index covers this, so there is no composite index to deploy and no cost
 * beyond the documents actually returned.
 */
export async function searchProfiles(term: string, excludeUid: string): Promise<Profile[]> {
  const needle = term.trim().toLowerCase();
  if (!needle) return [];

  const snap = await getDocs(
    query(
      collection(db(), 'users'),
      orderBy('usernameLower'),
      startAt(needle),
      endAt(`${needle}`),
      limit(20),
    ),
  );

  return snap.docs
    .map((d) => d.data() as Profile)
    .filter((p) => p.uid !== excludeUid);
}

// --------------------------------------------------------------------- chats

export function subscribeToChats(uid: string, onChange: (chats: Chat[]) => void): Unsubscribe {
  return onSnapshot(
    query(
      collection(db(), 'chats'),
      where('members', 'array-contains', uid),
      orderBy('lastMessageAt', 'desc'),
      limit(60),
    ),
    (snap) => onChange(snap.docs.map((d) => ({ ...(d.data() as Chat), id: d.id }))),
    (error) => console.error('chat list subscription failed', error),
  );
}

/** Creates the conversation document if this pair has never spoken before. */
export async function openConversation(me: Profile, them: Profile): Promise<string> {
  const id = chatIdFor(me.uid, them.uid);
  const ref = doc(db(), 'chats', id);
  const existing = await getDoc(ref);
  if (existing.exists()) return id;

  await setDoc(ref, {
    members: [me.uid, them.uid].sort(),
    memberNames: { [me.uid]: me.username, [them.uid]: them.username },
    memberHues: { [me.uid]: me.hue, [them.uid]: them.hue },
    lastMessage: '',
    lastMessageAt: Date.now(),
    lastSenderId: '',
    unread: { [me.uid]: 0, [them.uid]: 0 },
    typing: {},
    lastRead: { [me.uid]: Date.now() },
  });
  return id;
}

// ------------------------------------------------------------------ messages

export function subscribeToMessages(
  chatId: string,
  onChange: (messages: Message[], fromCache: boolean) => void,
): Unsubscribe {
  return onSnapshot(
    query(
      collection(db(), 'chats', chatId, 'messages'),
      orderBy('createdAt', 'asc'),
      limitToLast(MESSAGE_WINDOW),
    ),
    { includeMetadataChanges: true },
    (snap) => {
      const messages = snap.docs.map((d) => ({
        ...(d.data() as Message),
        id: d.id,
        // A message written offline has no server timestamp yet.
        pending: d.metadata.hasPendingWrites,
      }));
      onChange(messages, snap.metadata.fromCache);
    },
    (error) => console.error('message subscription failed', error),
  );
}

export async function sendMessage(opts: {
  chatId: string;
  senderId: string;
  recipientId: string;
  text: string;
  image?: string | null;
}): Promise<void> {
  const { chatId, senderId, recipientId, text, image } = opts;
  const trimmed = text.trim();
  if (!trimmed && !image) return;

  const batch = writeBatch(db());
  const messageRef = doc(collection(db(), 'chats', chatId, 'messages'));

  batch.set(messageRef, {
    senderId,
    text: trimmed,
    image: image ?? null,
    createdAt: serverTimestamp(),
  });

  // One write keeps the sidebar preview, the ordering key, the other side's
  // unread badge and our own typing flag in sync.
  batch.update(doc(db(), 'chats', chatId), {
    lastMessage: trimmed || '📷 Photo',
    lastMessageAt: Date.now(),
    lastSenderId: senderId,
    [`unread.${recipientId}`]: increment(1),
    [`unread.${senderId}`]: 0,
    [`lastRead.${senderId}`]: Date.now(),
    [`typing.${senderId}`]: 0,
  });

  await batch.commit();
}

export function markConversationRead(chatId: string, uid: string): Promise<void> {
  return updateDoc(doc(db(), 'chats', chatId), {
    [`unread.${uid}`]: 0,
    [`lastRead.${uid}`]: Date.now(),
  }).catch(() => undefined);
}

export function setTyping(chatId: string, uid: string, typing: boolean): Promise<void> {
  return updateDoc(doc(db(), 'chats', chatId), {
    [`typing.${uid}`]: typing ? Date.now() : 0,
  }).catch(() => undefined);
}

export function isTyping(chat: Chat | undefined, uid: string): boolean {
  const stamp = chat?.typing?.[uid] ?? 0;
  return stamp > 0 && Date.now() - stamp < TYPING_TTL_MS;
}

export function isOnline(lastSeen: number | undefined): boolean {
  return Boolean(lastSeen && Date.now() - lastSeen < PRESENCE_TTL_MS);
}

// ------------------------------------------------- closing & deleting chats

/**
 * Hides a conversation from one person's list without touching the other
 * person's copy or any of the messages. A message newer than the hide stamp
 * brings it straight back.
 */
export function hideConversation(chatId: string, uid: string): Promise<void> {
  return updateDoc(doc(db(), 'chats', chatId), {
    [`hiddenAt.${uid}`]: Date.now(),
  }).catch(() => undefined);
}

export function isHiddenFor(chat: Chat, uid: string): boolean {
  const hiddenAt = chat.hiddenAt?.[uid] ?? 0;
  return hiddenAt > 0 && chat.lastMessageAt <= hiddenAt;
}

/**
 * Permanently deletes a conversation and every message in it, for BOTH people.
 *
 * Firestore has no recursive delete on the client — that is an Admin SDK
 * feature, and the Admin SDK needs a server we deliberately do not have. So
 * the messages are paged through and deleted in batches (500 writes is the
 * hard batch limit) before the parent document goes.
 */
export async function deleteConversation(chatId: string): Promise<void> {
  const messages = collection(db(), 'chats', chatId, 'messages');

  // Page rather than reading the whole thread at once: a long conversation
  // with inlined photos could otherwise pull megabytes into memory.
  for (;;) {
    const page = await getDocs(query(messages, limit(400)));
    if (page.empty) break;

    const batch = writeBatch(db());
    page.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();

    if (page.size < 400) break;
  }

  await deleteDoc(doc(db(), 'chats', chatId));
}
