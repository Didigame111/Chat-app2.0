# Deploying Schoology 2.0 — free, no credit card

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
2. Name it (for example `schoology-chat`) and continue.
3. Google Analytics is optional — **turn it off**, it is not needed.
4. Wait for the project to be created, then open it.

## 2. Turn on Authentication

1. In the left sidebar: **Build → Authentication → Get started**.
2. Choose **Email/Password** from the sign-in providers list.
3. Enable the first toggle (**Email/Password**). Leave *Email link* off.
4. **Save.**

Schoology signs people in by username. It turns `alex` into
`alex@aura-users.invalid` behind the scenes, so the email/password provider is
all that is needed — no email is ever sent and no domain is needed.

## 3. Create the Firestore database

1. **Build → Firestore Database → Create database**.
2. Pick a location close to you. *This cannot be changed later.*
3. Choose **Start in production mode** — the real rules get deployed in step 6.
4. **Create.**

Firestore is included in the free plan. (Cloud **Storage** is not, on projects
created since late 2024 — which is exactly why Schoology compresses photos into the
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
VITE_FIREBASE_AUTH_DOMAIN=schoology-chat.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=schoology-chat
VITE_FIREBASE_STORAGE_BUCKET=schoology-chat.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789012
VITE_FIREBASE_APP_ID=1:123456789012:web:abc123
```

> These are not secrets. A Firebase web API key identifies your project; it
> grants nothing on its own. What actually protects your data is
> `firestore.rules`, which you deploy in step 6. `.env` is gitignored anyway.

Finally, point the project file at your project id — edit `.firebaserc` and
replace `YOUR_FIREBASE_PROJECT_ID`:

```json
{ "projects": { "default": "schoology-chat" } }
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
Hosting URL: https://schoology-chat.web.app
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

## 8. Make yourself an admin

The admin dashboard is hidden until your uid is listed in a single Firestore
document. Nothing in the app can write to that document — that is what stops
anyone promoting themselves — so you seed it by hand, once.

### Find your uid

1. Sign up in the app first, with the username you want to be the admin
2. Firebase console → **Build → Authentication → Users**
3. Find your row. The **User UID** column holds a string like
   `5XAyvOXHRP5cxaberNuN6MGSQyxy`. Copy it.

> The dashboard also prints each person's uid under their name, so once you're
> in you can match rows without coming back here.

### Create the document

1. Firebase console → **Build → Firestore Database → Data**
2. Click **Start collection** (or **+ Add collection** if you already have some)
3. **Collection ID:** `config` → Next
4. **Document ID:** `admins` — type it exactly; do *not* use the auto-ID button
5. Add one field:
   - **Field name:** `uids`
   - **Type:** `array`
   - Click **Add item**, leave the item type as `string`, and paste your uid
6. **Save**

You should end up with `config/admins` containing `uids: ["your-uid-here"]`.

### Check it

Reload the app. An **Admin dashboard** button appears above your name in the
sidebar — no redeploy needed, the app watches that document live.

To add another admin later, open the same document and add a second item to the
`uids` array.

---

## 9. Deleting accounts — what the dashboard can and cannot do

Worth understanding before you rely on it.

The dashboard's **Delete** erases the person's profile and every conversation
they were part of, including the other person's copy of those messages, and
leaves the account blocked. Blocked means they are signed out everywhere within
a second and cannot sign back in — so the account is genuinely unusable.

What it does **not** do is remove the Firebase Authentication record itself.
That requires the Firebase Admin SDK; the Admin SDK only runs on a server; a
server means Cloud Functions, which is Blaze-only. There is no client-side
equivalent — the client SDK can only delete its *own* account.

So the record sits dormant, visible to nobody but you. To finish the job:

1. Firebase console → **Build → Authentication → Users**
2. Find the row — match the uid the dashboard showed you
3. Open the **⋮** menu at the end of the row → **Delete account**

If you skip this, nothing breaks. The account stays blocked and unusable; the
row just lingers in your user list. The only practical consequence is that the
username stays taken, since Firebase Auth uniqueness is what enforces that.

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

**The Admin dashboard button never appears.** The `config/admins` document is
wrong. It must be collection `config`, document id exactly `admins`, field
`uids` of type **array** containing your uid as a string. A common slip is
letting Firestore auto-generate the document id instead of typing `admins`.

**Admin actions fail with a permission error.** Either your uid is not in
`config/admins`, or the rules that read it were never deployed — run
`firebase deploy --only firestore:rules`.

**404 on a page other than `/`.** The SPA rewrite in `firebase.json` handles
this; make sure you deployed hosting after any change to that file.

### If Firebase asks you to upgrade

Nothing this project uses requires the Blaze plan. If you hit an upgrade prompt,
you have most likely wandered into one of these — all of which Schoology avoids by
design:

- **Cloud Storage for Firebase** — Blaze-only on newer projects. Schoology inlines
  compressed photos into Firestore instead.
- **Cloud Functions** — Blaze-only. Schoology has no server code at all.
- **Firebase App Hosting** — Blaze-only, and for server-rendered frameworks.
  Schoology deploys to classic **Hosting**; make sure you are in the
  **Build → Hosting** section, not **App Hosting**.
- **Firebase Data Connect / Cloud SQL** — Blaze-only. Not used.

Back out of the prompt; nothing has been charged and nothing is required.

---

## Updating the site later

Deploying a change after this first setup — especially from GitHub Codespaces —
is covered in **[UPDATING.md](UPDATING.md)**.

## Keeping it free

A short audit of this exact code is in
[README → Verified free-plan compatibility](README.md#verified-free-plan-compatibility):
which Firebase modules it imports, why photos and notifications work the way
they do, and the write-volume arithmetic.

### The numbers

The Spark plan's daily Firestore allowance is 50,000 reads, 20,000 writes and
20,000 deletes, plus 1 GiB stored. Hosting gives 10 GB of storage and 360 MB of
transfer per day.

Sending a message costs 3 writes and 1 read; receiving costs 1 read and 1
write. The online-presence heartbeat is 1 write per user every 150 seconds, and
only while the app is actually on screen — that interval is deliberately slow,
because it is the largest single consumer of the write quota.

Twenty people exchanging fifty messages each lands around 7,000 writes and
8,000 reads in a day, roughly a third of the allowance.

Spark has no billing attached, so exceeding a quota pauses the service until the
daily reset. It cannot generate a bill.
