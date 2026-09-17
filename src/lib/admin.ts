import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
  where,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from '../firebase';
import { deleteConversation } from './chat';
import type { Profile } from './types';

/**
 * The built-in administrator.
 *
 * Admin normally means "your uid is listed in config/admins", but that document
 * has to be seeded by hand and a uid does not exist until someone has signed
 * up — so a freshly deployed copy of this app would have no administrator at
 * all. This one account is therefore recognised by username instead, which is
 * known ahead of time.
 *
 * Exactly one account can ever hold it: usernames map to Firebase Auth
 * addresses (arthurlima@...), Auth enforces uniqueness on those, the mapping
 * lowercases, and firestore.rules freezes usernameLower after the profile is
 * created. So this cannot be taken twice, or renamed onto.
 *
 * ⚠️ This value is duplicated in firestore.rules, which is what actually
 * enforces it — the check here only decides whether to show the dashboard
 * button. Change one and you must change the other.
 */
export const DEFAULT_ADMIN_USERNAME = 'arthurlima';

/** True for the built-in administrator, regardless of how they typed the name. */
export function isDefaultAdmin(profile: Pick<Profile, 'usernameLower'> | null | undefined): boolean {
  return profile?.usernameLower === DEFAULT_ADMIN_USERNAME;
}

/** True for the built-in administrator or anyone listed in config/admins. */
export function hasAdminRights(
  profile: Pick<Profile, 'uid' | 'usernameLower'> | null | undefined,
  adminUids: string[],
): boolean {
  if (!profile) return false;
  return isDefaultAdmin(profile) || adminUids.includes(profile.uid);
}

/**
 * Who counts as an admin.
 *
 * The list lives in a single Firestore document, `config/admins`, holding a
 * `uids` array — and firestore.rules reads that same document to decide what
 * an admin may do. That is the important part: admin power is enforced on the
 * server side of the rules engine, not by this file. Hiding the dashboard
 * button in the UI is only a convenience; someone who forged their way past it
 * would still be refused by the rules.
 *
 * The document is seeded by hand in the Firebase console (see DEPLOY.md) and
 * nobody can write to it from the app, so there is no way to promote yourself.
 *
 * It is also optional: DEFAULT_ADMIN_USERNAME above is recognised whether or
 * not this document exists, so a fresh deployment still has an administrator.
 */
export function subscribeToAdmins(onChange: (uids: string[]) => void): Unsubscribe {
  return onSnapshot(
    doc(db(), 'config', 'admins'),
    (snap) => onChange((snap.data()?.uids as string[] | undefined) ?? []),
    // Absent document, or rules refusing the read: nobody is an admin.
    () => onChange([]),
  );
}

/** Everyone who has ever created an account, newest first. */
export function subscribeToAllUsers(onChange: (users: Profile[]) => void): Unsubscribe {
  return onSnapshot(
    query(collection(db(), 'users'), orderBy('createdAt', 'desc'), limit(500)),
    (snap) => onChange(snap.docs.map((d) => d.data() as Profile)),
    (error) => {
      console.error('admin user list failed', error);
      onChange([]);
    },
  );
}

/**
 * Blocks or unblocks someone.
 *
 * This is the part that actually takes effect immediately: the app watches its
 * own profile document, so a blocked person is signed out wherever they are
 * within a second, and cannot get back in.
 */
export function setUserBlocked(uid: string, blocked: boolean): Promise<void> {
  return updateDoc(doc(db(), 'users', uid), { blocked, removing: false });
}

export interface PurgeResult {
  conversationsDeleted: number;
}

/**
 * Deletes everything this app knows about a person: every conversation they
 * were part of (messages included, for both sides) and their directory entry.
 * They also stay blocked, so the dormant sign-in record cannot be used.
 *
 * What this canNOT do is remove the Firebase Authentication record itself.
 * Deleting another user's auth account is an Admin SDK operation, the Admin
 * SDK only runs on a server, and a server means Cloud Functions and the paid
 * plan. The client SDK can only ever delete its *own* account. So the auth
 * record is left behind — invisible to everyone except the project owner — and
 * DEPLOY.md documents the two-click console step to finish the job.
 */
export async function purgeUser(uid: string): Promise<PurgeResult> {
  // Block first: if anything below fails partway, they are still locked out.
  // `removing` rides along so they are told they were removed, not just
  // blocked — the profile document is gone before they could read it.
  await updateDoc(doc(db(), 'users', uid), { blocked: true, removing: true }).catch(
    () => undefined,
  );

  const chats = await getDocs(
    query(collection(db(), 'chats'), where('members', 'array-contains', uid)),
  );

  for (const chat of chats.docs) {
    await deleteConversation(chat.id);
  }

  await deleteDoc(doc(db(), 'users', uid));

  return { conversationsDeleted: chats.size };
}
