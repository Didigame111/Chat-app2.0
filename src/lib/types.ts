import type { Timestamp } from 'firebase/firestore';

export interface Profile {
  uid: string;
  username: string;
  usernameLower: string;
  /** Hue (0-360) used to colour the person's avatar consistently everywhere. */
  hue: number;
  createdAt: Timestamp | null;
  lastSeen: number;
}

export interface Chat {
  id: string;
  members: string[];
  /** uid -> username, denormalised so the sidebar renders from one query. */
  memberNames: Record<string, string>;
  memberHues: Record<string, number>;
  lastMessage: string;
  lastMessageAt: number;
  lastSenderId: string;
  /** uid -> number of messages that arrived since that person last looked. */
  unread: Record<string, number>;
  /** uid -> epoch ms of their last keystroke; stale entries are ignored. */
  typing: Record<string, number>;
  /** uid -> epoch ms of the newest message they have seen. */
  lastRead: Record<string, number>;
}

export interface Message {
  id: string;
  senderId: string;
  text: string;
  image?: string | null;
  createdAt: Timestamp | null;
  /** Set locally on messages still in flight so the UI can show a clock. */
  pending?: boolean;
}
