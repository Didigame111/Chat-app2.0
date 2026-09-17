import { initializeApp, type FirebaseApp, type FirebaseOptions } from 'firebase/app';
import { connectAuthEmulator, getAuth, type Auth } from 'firebase/auth';
import {
  connectFirestoreEmulator,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  type Firestore,
} from 'firebase/firestore';

declare global {
  interface Window {
    __FIREBASE_CONFIG__?: FirebaseOptions;
  }
}

/**
 * Usernames are the handle people search for, but Firebase Auth signs people
 * in with an email address. We bridge the two with a synthetic address on a
 * reserved, permanently unresolvable TLD (RFC 2606), so no mail is ever sent
 * and nobody has to own a domain. Nothing here needs a paid plan.
 *
 * NOTE: this domain deliberately kept its original spelling through the
 * rename to Schoology. It is the identity Firebase Auth stores for every
 * existing account — changing it would lock out everyone who has already
 * signed up. It is internal plumbing and never shown to anyone.
 */
export const USER_EMAIL_DOMAIN =
  import.meta.env.VITE_AUTH_EMAIL_DOMAIN || 'aura-users.invalid';

export function usernameToEmail(username: string): string {
  return `${username.trim().toLowerCase()}@${USER_EMAIL_DOMAIN}`;
}

function readConfig(): FirebaseOptions | null {
  // Runtime override (public/firebase-config.js) wins, so a built copy of the
  // app can be re-pointed at another project without a rebuild.
  const runtime = typeof window !== 'undefined' ? window.__FIREBASE_CONFIG__ : undefined;
  if (runtime?.apiKey && runtime?.projectId) return runtime;

  const env = import.meta.env;
  const built: FirebaseOptions = {
    apiKey: env.VITE_FIREBASE_API_KEY,
    authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: env.VITE_FIREBASE_APP_ID,
  };
  return built.apiKey && built.projectId ? built : null;
}

const config = readConfig();

/** False when nobody has filled in a Firebase project yet — App shows setup help. */
export const isConfigured = config !== null;

let app: FirebaseApp | null = null;
let authInstance: Auth | null = null;
let dbInstance: Firestore | null = null;

if (config) {
  app = initializeApp(config);
  authInstance = getAuth(app);
  dbInstance = initializeFirestore(app, {
    // Offline cache: an iPad that loses Wi-Fi mid-lesson keeps showing the
    // conversation, and queued sends flush when it reconnects. Multi-tab
    // manager keeps Safari's Split View (two Schoology windows) consistent.
    localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
  });

  // Local development against `firebase emulators:start`, so you can build and
  // test without creating real accounts or spending real free-tier quota.
  // Enabled by setting VITE_USE_EMULATORS=1 in .env.local.
  if (import.meta.env.VITE_USE_EMULATORS === '1') {
    connectAuthEmulator(authInstance, 'http://127.0.0.1:9099', { disableWarnings: true });
    connectFirestoreEmulator(dbInstance, '127.0.0.1', 8080);
  }
}

function required<T>(value: T | null, what: string): T {
  if (value === null) {
    throw new Error(
      `${what} is unavailable because Firebase is not configured. ` +
        'Copy .env.example to .env and fill in your VITE_FIREBASE_* values.',
    );
  }
  return value;
}

export const auth = () => required(authInstance, 'Firebase Auth');
export const db = () => required(dbInstance, 'Cloud Firestore');
