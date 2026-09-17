import { useCallback, useEffect, useState } from 'react';
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  type User,
} from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { auth, db, usernameToEmail } from '../firebase';
import { createProfile, getProfile, touchPresence } from '../lib/chat';
import type { Profile } from '../lib/types';

export type SessionStatus = 'loading' | 'signed-out' | 'ready';

export interface Session {
  status: SessionStatus;
  user: User | null;
  profile: Profile | null;
  /** Set when the last sign-out was forced rather than chosen. */
  notice: string | null;
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
  signOutOfSchoology: () => Promise<void>;
} {
  const [session, setSession] = useState<Session>({
    status: 'loading',
    user: null,
    profile: null,
    notice: null,
  });

  useEffect(() => {
    let watchProfile: (() => void) | undefined;

    const stop = onAuthStateChanged(auth(), async (user) => {
      watchProfile?.();
      watchProfile = undefined;

      if (!user) {
        setSession((prev) => ({
          status: 'signed-out',
          user: null,
          profile: null,
          // Keep any "you were removed" message across the sign-out.
          notice: prev.notice,
        }));
        return;
      }

      // The profile document is separate from the auth record: it is the
      // searchable directory entry other people find you by.
      const existing = await getProfile(user.uid);
      if (!existing) {
        const fallback = user.displayName || user.email?.split('@')[0] || 'friend';
        await createProfile(user.uid, fallback);
      }

      // Watched, not fetched once, so an admin blocking or removing this
      // account takes effect wherever they are signed in — within a second,
      // without waiting for a reload.
      watchProfile = onSnapshot(doc(db(), 'users', user.uid), (snap) => {
        const profile = snap.data() as Profile | undefined;

        if (!profile) {
          void signOut(auth());
          setSession({
            status: 'signed-out',
            user: null,
            profile: null,
            notice: 'This account has been removed by an administrator.',
          });
          return;
        }

        if (profile.blocked) {
          void signOut(auth());
          setSession({
            status: 'signed-out',
            user: null,
            profile: null,
            notice: profile.removing
              ? 'This account has been removed by an administrator.'
              : 'This account has been blocked by an administrator.',
          });
          return;
        }

        setSession({ status: 'ready', user, profile, notice: null });
      });
    });

    return () => {
      watchProfile?.();
      stop();
    };
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
    setSession((prev) => ({ ...prev, notice: null }));
    await signInWithEmailAndPassword(auth(), usernameToEmail(username), password);
  }, []);

  const signOutOfSchoology = useCallback(async () => {
    setSession((prev) => ({ ...prev, notice: null }));
    await signOut(auth());
  }, []);

  return { ...session, signUp, signIn, signOutOfSchoology };
}
