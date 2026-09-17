# Updating the live site from GitHub Codespaces

You already deployed once from a Codespace, so this is the loop you'll run
every time you want a change to show up on your `.web.app` URL.

**The short version, once you're set up:**

```bash
npm run build
firebase deploy --only hosting
```

Everything below explains the setup, the gotchas, and what to do when a fresh
Codespace has forgotten things.

---

## The five-minute version

1. Open the Codespace (**github.com → your repo → Code ▾ → Codespaces**)
2. In the terminal: `git pull`
3. Make your changes
4. `npm run build`
5. `firebase deploy --only hosting`
6. `git add -A && git commit -m "what you changed" && git push`

> Deploying from a branch is fine, but `main` should be what's live. If you
> deploy from a branch and then merge it, nothing changes on the site — the
> merge doesn't redeploy. Deployment only ever happens when you run
> `firebase deploy`.

**Do not skip step 6.** A Codespace can be deleted at any time — by you, or
automatically after 30 days idle. Deploying puts your change on the website but
*not* in the repository. If the Codespace vanishes before you push, the live
site keeps running the code you no longer have the source for.

---

## First run in a NEW Codespace

A Codespace is rebuilt from the repository, and two things you need are
deliberately not in the repository. So the first time you open a fresh one:

### 1. Is the tooling there?

```bash
firebase --version
```

If that prints a version, skip to the next section — the devcontainer already
installed it. If it says *command not found*:

```bash
npm install -g firebase-tools
npm install
```

> The repo now ships a `.devcontainer/` config that installs Node, the Firebase
> CLI and the project's dependencies automatically. Codespaces created **before**
> that existed won't have it. To pick it up, delete the old Codespace and create
> a new one, or just run the two commands above.

### 2. Does it have your Firebase config?

```bash
cat .env
```

`.env` is gitignored — it holds your Firebase keys and never gets committed —
so a fresh Codespace has no copy of it.

**If the file is missing or empty**, and you built without noticing, the site
deploys to the "Almost there" setup screen. Two ways to fix it:

**Option A — paste it once (quick):**

```bash
cp .env.example .env
```

Open `.env` in the editor and fill in the six values from
**Firebase console → ⚙️ Project settings → General → Your apps → SDK setup and
configuration → Config**.

**Option B — Codespaces secrets (do this once, never think about it again):**

1. Go to **github.com/settings/codespaces**
2. Under *Codespaces secrets*, click **New secret**
3. Add each of these six, with the value from the Firebase console:

   | Secret name | Example value |
   |---|---|
   | `VITE_FIREBASE_API_KEY` | `AIzaSy...` |
   | `VITE_FIREBASE_AUTH_DOMAIN` | `your-project.firebaseapp.com` |
   | `VITE_FIREBASE_PROJECT_ID` | `your-project` |
   | `VITE_FIREBASE_STORAGE_BUCKET` | `your-project.firebasestorage.app` |
   | `VITE_FIREBASE_MESSAGING_SENDER_ID` | `123456789012` |
   | `VITE_FIREBASE_APP_ID` | `1:123456789012:web:abc123` |

4. For each, grant it access to this repository
5. Rebuild the Codespace (**Ctrl/Cmd+Shift+P → Codespaces: Rebuild Container**)

From then on every new Codespace writes its own `.env` on creation. If you set
the secrets up on an existing Codespace, run it manually once:

```bash
node scripts/write-env.mjs
```

### 3. Log in to Firebase

```bash
firebase login --no-localhost
```

⚠️ **The `--no-localhost` flag matters in Codespaces.** Plain `firebase login`
tries to open a browser on the machine running the CLI and listen on a local
port — but the CLI is running on a server in a datacentre, not on your laptop,
so the callback never arrives and it hangs. `--no-localhost` prints a URL
instead: open it, approve, and paste the code it gives you back into the
terminal.

**Check it worked:**

```bash
firebase projects:list
```

Your project should be in the list.

> Codespaces sessions do expire. If a deploy ever fails with an
> authentication error, just run `firebase login --no-localhost` again.

---

## The normal update loop

### 1. Get the latest code

```bash
git pull
```

Do this **before** you start editing, especially if changes were pushed from
somewhere else. If `git pull` complains that you have local changes, either
commit them first or run `git stash`, pull, then `git stash pop`.

### 2. Check what branch you're on

```bash
git branch --show-current
```

Once a `claude/...` branch has been merged, **`main`** is the live code and is
where you should be:

```bash
git checkout main
git pull
```

If there's an unmerged `claude/...` branch you want to try out first, check
that out instead — but remember whatever you deploy from is what goes live,
merged or not. The safest order is: merge the pull request on GitHub, then
`git checkout main && git pull`, then deploy.

### 3. Make your change and preview it

Don't deploy blind. Run it in the Codespace first:

```bash
npm run dev
```

Codespaces pops a toast offering to open the forwarded port — click **Open in
Browser**. The site reloads as you edit.

You'll notice sign-in works here: `npm run dev` talks to your *real* Firebase
project, so accounts and messages you create while testing are real. Use a
throwaway username, or use the emulators instead:

```bash
echo "VITE_USE_EMULATORS=1" >> .env.local
firebase emulators:start --only auth,firestore   # in a second terminal
npm run dev
```

That runs against a local fake Firebase — nothing touches your live data or
your free-tier quota, and it's wiped when you stop it. Delete `.env.local` to
go back to the real project.

Stop the dev server with `Ctrl+C`.

### 4. Build

```bash
npm run build
```

Compiles into `dist/`, which is what actually gets uploaded. Ends with
`✓ built in 3.5s`. The yellow warning about chunks over 500 kB is normal.

**If the build fails, stop.** Do not deploy. A failed build leaves the old
`dist/` in place, so deploying would silently ship your *previous* version and
you'd think the change didn't work.

### 5. Deploy

```bash
firebase deploy --only hosting
```

~30 seconds. Ends with your Hosting URL.

There's a shortcut that does steps 4 and 5 together:

```bash
npm run deploy:hosting
```

### 6. Commit and push

```bash
git add -A
git commit -m "Describe what you changed"
git push
```

---

## When you also need to deploy rules

Most changes are just code, and `--only hosting` is right. But if you edited
**`firestore.rules`** or **`firestore.indexes.json`**, hosting alone won't
apply them:

```bash
firebase deploy --only hosting,firestore
```

or `npm run deploy`, which does both.

**How to know you needed this:** the site loads and looks right, but actions
fail with *Missing or insufficient permissions* in the browser console. That's
almost always rules that were edited but never deployed.

---

## Checking that your update actually went live

1. Open the Hosting URL in a **private/incognito window** — a normal window may
   serve you the cached version
2. Confirm your change is visible
3. In the Firebase console: **Build → Hosting** shows a release history with
   timestamps. Your deploy should be at the top.

If the old version persists:

- `index.html` and `sw.js` are served with no-cache headers, so a plain reload
  is normally enough
- An **installed Home Screen app on the iPad** can hold the old service worker
  for one launch. Swipe it away in the app switcher and reopen.
- Worst case, in the Firebase console under **Hosting**, check the release
  timestamp — if there's no recent release, the deploy didn't actually run.

---

## Rolling back a bad deploy

You don't need the code for this. In the Firebase console:

**Build → Hosting → Release history →** find the previous good release, open
its **⋮** menu, choose **Rollback**.

The site reverts in seconds. Then fix the code properly and deploy again.

---

## Quick reference

| I want to… | Command |
|---|---|
| Get the latest code | `git pull` |
| Preview locally | `npm run dev` |
| Preview against fake Firebase | `VITE_USE_EMULATORS=1` in `.env.local` + `firebase emulators:start` |
| Ship a code change | `npm run deploy:hosting` |
| Ship a rules change too | `npm run deploy` |
| Save your work | `git add -A && git commit -m "..." && git push` |
| Log in again | `firebase login --no-localhost` |
| Recreate `.env` from secrets | `node scripts/write-env.mjs` |
| Undo a bad deploy | Firebase console → Hosting → Release history → Rollback |

---

## Things that will bite you

**Deploying without pushing.** The most common one. Your website is updated,
your repo isn't. Always finish with `git push`.

**Forgetting `--no-localhost` on login.** It hangs forever with no useful error.

**A rebuilt Codespace losing `.env`.** Everything builds fine and the deployed
site shows the setup screen. Set up Codespaces secrets and this stops happening.

**Editing rules and deploying only hosting.** Silent until someone hits a
permission error.

**Deploying after a failed build.** Ships the previous version. Read the build
output before you deploy.
