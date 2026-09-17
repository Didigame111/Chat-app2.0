# Deploying Aura Chat 2.0 — free, no credit card

Every service used here is on Firebase's **Spark** plan, which is free and does
not ask for a billing account. You will not be asked for a card at any point. If
a screen ever does ask you to upgrade, stop — something has gone off the path
below, and the [troubleshooting section](#if-firebase-asks-you-to-upgrade)
explains why.

Budget about 15 minutes.

---

## What you need

- A Google account
- Node.js 20 or newer (`node -v`)

---

## 1. Create the Firebase project

1. Go to <https://console.firebase.google.com> and click **Create a project**.
2. Name it (for example `aura-chat`) and continue.
3. Google Analytics is optional — **turn it off**, it is not needed.
4. Wait for the project to be created, then open it.

## 2. Turn on Authentication

1. In the left sidebar: **Build → Authentication → Get started**.
2. Choose **Email/Password** from the sign-in providers list.
3. Enable the first toggle (**Email/Password**). Leave *Email link* off.
4. **Save.**

Aura signs people in by username. It turns `alex` into
`alex@aura-users.invalid` behind the scenes, so the email/password provider is
all that is needed — no email is ever sent and no domain is needed.

## 3. Create the Firestore database

1. **Build → Firestore Database → Create database**.
2. Pick a location close to you. *This cannot be changed later.*
3. Choose **Start in production mode** — the real rules get deployed in step 6.
4. **Create.**

Firestore is included in the free plan. (Cloud **Storage** is not, on projects
created since late 2024 — which is exactly why Aura compresses photos into the
message itself and never touches it.)

## 4. Register a web app and copy the config

1. Click the gear icon → **Project settings**.
2. Scroll to **Your apps** and click the **Web** icon (`</>`).
3. Give it a nickname. **Do not** tick "Also set up Firebase Hosting" — the CLI
   does that in step 6.
4. Copy the `firebaseConfig` object it shows you.

Now, in this repo:

```bash
cp .env.example .env
```

Open `.env` and paste the values across:

```ini
VITE_FIREBASE_API_KEY=AIza...
VITE_FIREBASE_AUTH_DOMAIN=aura-chat.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=aura-chat
VITE_FIREBASE_STORAGE_BUCKET=aura-chat.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789012
VITE_FIREBASE_APP_ID=1:123456789012:web:abc123
```

> These are not secrets. A Firebase web API key identifies your project; it
> grants nothing on its own. What actually protects your data is
> `firestore.rules`, which you deploy in step 6. `.env` is gitignored anyway.

Finally, point the project file at your project id — edit `.firebaserc` and
replace `YOUR_FIREBASE_PROJECT_ID`:

```json
{ "projects": { "default": "aura-chat" } }
```

## 5. Install the tooling

```bash
npm install
npm install -g firebase-tools
firebase login
```

`firebase login` opens a browser window for your Google account.

## 6. Build and deploy

```bash
npm run build
firebase deploy --only hosting,firestore
```

That does three things: uploads `dist/` to Firebase Hosting, installs
`firestore.rules`, and creates the index the conversation list needs.

The output ends with your live URL:

```
Hosting URL: https://aura-chat.web.app
```

Open it on an iPad. Create two accounts (a second one in a private tab, or on a
second device), search for one from the other, and send a message.

There is a shortcut for later changes:

```bash
npm run deploy          # build + deploy hosting and firestore
npm run deploy:hosting  # build + deploy hosting only (faster)
```

---

## 7. Put it on the iPad Home Screen

On the iPad, in Safari:

1. Open your `https://…web.app` URL.
2. Tap the **Share** button, then **Add to Home Screen**.
3. Name it and tap **Add**.

It now launches full screen with no Safari chrome, gets its own app icon and
switcher card, opens offline, and can show notification banners while it is
running (iPadOS 16.4+ requires the Home Screen install for this).

---

## Local development

Against your real project:

```bash
npm run dev     # http://localhost:5173
```

Against the local emulators, so you never spend free-tier quota or create real
accounts while building:

```bash
echo "VITE_USE_EMULATORS=1" >> .env.local
firebase emulators:start --only auth,firestore
npm run dev
```

The emulator loads the same `firestore.rules`, so a rules mistake shows up
locally rather than in production. Emulator state is wiped on exit.

---

## Troubleshooting

**"Almost there" setup screen instead of the app.** `.env` is missing or
incomplete. Vite only reads `.env` at build time — re-run `npm run build` (or
restart `npm run dev`) after editing it.

**`auth/operation-not-allowed` when signing up.** Email/Password is still off in
the console. Go back to step 2.

**`Missing or insufficient permissions`.** The rules did not deploy. Run
`firebase deploy --only firestore:rules` and check the console under
**Firestore → Rules** that the file matches this repo's `firestore.rules`.

**`The query requires an index`.** Run `firebase deploy --only
firestore:indexes` and give it a minute to build. The error message in the
browser console also contains a one-click link that creates it.

**A deploy succeeds but the old version still loads.** `index.html` and `sw.js`
are served no-cache, so a normal reload is enough — but an installed Home Screen
app can hold onto the old service worker for one launch. Close it from the app
switcher and reopen.

**404 on a page other than `/`.** The SPA rewrite in `firebase.json` handles
this; make sure you deployed hosting after any change to that file.

### If Firebase asks you to upgrade

Nothing this project uses requires the Blaze plan. If you hit an upgrade prompt,
you have most likely wandered into one of these — all of which Aura avoids by
design:

- **Cloud Storage for Firebase** — Blaze-only on newer projects. Aura inlines
  compressed photos into Firestore instead.
- **Cloud Functions** — Blaze-only. Aura has no server code at all.
- **Firebase App Hosting** — Blaze-only, and for server-rendered frameworks.
  Aura deploys to classic **Hosting**; make sure you are in the
  **Build → Hosting** section, not **App Hosting**.
- **Firebase Data Connect / Cloud SQL** — Blaze-only. Not used.

Back out of the prompt; nothing has been charged and nothing is required.

---

## Keeping it free

The Spark plan's daily Firestore allowance is 50,000 reads, 20,000 writes and
20,000 deletes, plus 1 GiB stored. Hosting gives 10 GB of storage and 360 MB of
transfer per day. Aura spends 2 writes per message sent and 2 reads per message
received, so ordinary use by a small group stays far inside the limits. Presence
heartbeats are one write per user per minute, and only while the app is
actually on screen.

Spark has no billing attached, so exceeding a quota pauses the service until the
daily reset. It cannot generate a bill.
