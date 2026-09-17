/**
 * Writes .env from environment variables, if it does not already exist.
 *
 * This exists for GitHub Codespaces. A Codespace is rebuilt from the repo, and
 * .env is gitignored, so a fresh Codespace has no Firebase config and the app
 * comes up on the "Almost there" setup screen. Storing the six values as
 * Codespaces secrets (see UPDATING.md) lets this recreate the file on every
 * rebuild, so you never paste them again.
 *
 * It never overwrites an existing .env, and it does nothing at all when the
 * secrets are not set — locally, you just write .env by hand as usual.
 */
import { existsSync, writeFileSync } from 'node:fs';

const KEYS = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_STORAGE_BUCKET',
  'VITE_FIREBASE_MESSAGING_SENDER_ID',
  'VITE_FIREBASE_APP_ID',
];

if (existsSync('.env')) {
  console.log('.env already exists — leaving it alone.');
  process.exit(0);
}

const present = KEYS.filter((key) => process.env[key]);

if (present.length === 0) {
  console.log(
    'No VITE_FIREBASE_* variables set. Copy .env.example to .env and fill it in,\n' +
      'or add them as Codespaces secrets so this runs automatically next rebuild.',
  );
  process.exit(0);
}

if (present.length < KEYS.length) {
  const missing = KEYS.filter((key) => !process.env[key]);
  console.warn(`Warning: these are not set and will be blank: ${missing.join(', ')}`);
}

writeFileSync('.env', KEYS.map((key) => `${key}=${process.env[key] ?? ''}`).join('\n') + '\n');
console.log(`Wrote .env from ${present.length} environment variable(s).`);
