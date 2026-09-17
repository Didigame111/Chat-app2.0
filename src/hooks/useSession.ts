import { useCallback, useEffect, useState } from 'react';
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  type User,
} from 'firebase/auth';
import { auth, usernameToEmail } from '../firebase';
import { createProfile, getProfile, touchPresence } from '../lib/chat';
import type { Profile } from '../lib/types';

export type SessionStatus = 'loading' | 'signed-out' | 'ready';

export interface Session {
  status: SessionStatus;
  user: User | null;
  profile: Profile | null;
}

const PRESENCE_INTERVAL_MS = 45_000;

export const USERNAME_PATTERN = /^[a-zA-Z0-9._-]{3,24}$/;

/** Turns Firebase's error codes into something worth showing a person. */
export function describeAuthError(error: unknown): string {
  const code = (error as { code?: string })?.code ?? '';
  switch (code) {
    case 'auth/email-already-in-use':
      return 'That username is already taken.';
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'Wrong username or password.';
    case 'auth/weak-password':
      return 'Passwords need to be at least 6 characters.';
    case 'auth/too-many-requests':
      return 'Too many attempts. Wait a minute and try again.';
    case 'auth/network-request-failed':
      return 'No connection. Check Wi-Fi and try again.';
    case 'auth/operation-not-allowed':
      return 'Email/password sign-in is switched off in the Firebase console.';
    default:
      return (error as Error)?.message || 'Something went wrong. Try again.';
  }
}

export function useSession(): Session & {
  signUp: (username: string, password: string) => Promise<void>;
  signIn: (username: string, password: string) => Promise<void>;
  signOutOfAura: () => Promise<void>;
} {
  const [session, setSession] = useState<Session>({
    status: 'loading',
    user: null,
    profile: null,
  });

  useEffect(() => {
    return onAuthStateChanged(auth(), async (user) => {
      if (!user) {
        setSession({ status: 'signed-out', user: null, profile: null });
        return;
      }

      // The profile document is separate from the auth record: it is the
      // searchable directory entry other people find you by.
      let profile = await getProfile(user.uid);
      if (!profile) {
        const fallback = user.displayName || user.email?.split('@')[0] || 'friend';
        profile = await createProfile(user.uid, fallback);
      }
      setSession({ status: 'ready', user, profile });
    });
  }, []);

  // Heartbeat that drives the green "online" dot. One small write a minute,
  // which stays far inside the free tier's daily write allowance.
  useEffect(() => {
    if (session.status !== 'ready' || !session.user) return;
    const uid = session.user.uid;

    const beat = () => {
      if (document.visibilityState === 'visible') void touchPresence(uid);
    };
    beat();
    const timer = window.setInterval(beat, PRESENCE_INTERVAL_MS);
    document.addEventListener('visibilitychange', beat);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', beat);
    };
  }, [session.status, session.user]);

  const signUp = useCallback(async (username: string, password: string) => {
    const clean = username.trim();
    if (!USERNAME_PATTERN.test(clean)) {
      throw new Error('Usernames are 3-24 characters: letters, numbers, . _ or -');
    }
    const credential = await createUserWithEmailAndPassword(
      auth(),
      usernameToEmail(clean),
      password,
    );
    await updateProfile(credential.user, { displayName: clean });
    await createProfile(credential.user.uid, clean);
  }, []);

  const signIn = useCallback(async (username: string, password: string) => {
    await signInWithEmailAndPassword(auth(), usernameToEmail(username), password);
  }, []);

  const signOutOfAura = useCallback(async () => {
    await signOut(auth());
  }, []);

  return { ...session, signUp, signIn, signOutOfAura };
}
