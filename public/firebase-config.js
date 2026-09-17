/*
 * Optional runtime Firebase config.
 *
 * You normally do NOT need this file: copy .env.example to .env, fill in the
 * VITE_FIREBASE_* values, and `npm run build` bakes them into the bundle.
 *
 * This exists for the other case — someone hands you a built copy of the app
 * and you want to point it at your own Firebase project without installing
 * Node. Uncomment the block below, paste the config object Firebase shows you
 * under Project settings -> Your apps -> Web app, and redeploy. Values set
 * here win over the build-time ones.
 *
 * These keys are not secrets. A Firebase web API key identifies your project,
 * it does not authorise anything — access is controlled by firestore.rules.
 */

// window.__FIREBASE_CONFIG__ = {
//   apiKey: "...",
//   authDomain: "your-project.firebaseapp.com",
//   projectId: "your-project",
//   storageBucket: "your-project.firebasestorage.app",
//   messagingSenderId: "000000000000",
//   appId: "1:000000000000:web:abcdef1234567890"
// };
