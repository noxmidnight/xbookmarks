# XBookmarks

Premium-style **bookmark folders** for X — without X Premium.

- **Desktop (default):** Browser extension saves folders + bookmarks **locally** (`chrome.storage.local`). No account required.
- **Phone (optional):** PWA synced via **Appwrite** Cloud.

```
XBookmarks/
  apps/web          PWA (Appwrite auth + DB)
  apps/extension    Browser extension — local-first
  packages/shared   Shared types + Appwrite API helpers
  appwrite/         Cloud setup notes
```

## Desktop — local only

```bash
pnpm install
pnpm build:ext
```

Load unpacked in Brave from:

- `~/Downloads/XBookmarks-Brave`, or
- `/home/nox/Code/XBookmarks/XBookmarks-Brave`

Reload `x.com` → use X normally. Open **Bookmarks** in the left nav for folders. Bookmark any post → pick a folder.

## Phone — Android app (recommended)

Single app: **Feed** (x.com) + **Folders**. No Share-sheet hopping.

1. Download the latest **APK** from [Releases](https://github.com/noxmidnight/xbookmarks/releases) (allow unknown sources).
2. Sign in with email **OTP** (6-digit code).
3. **Feed** → open a tweet → **Bookmark** → pick folder.
4. In **Folders** / **All**, **Open** loads the post in the Feed tab (not an external browser).

Full steps: [apps/web/ANDROID.md](apps/web/ANDROID.md)

Rebuild: `pnpm build:android`

## Phone PWA (optional)

Live: **https://xbookmarks.appwrite.network**

- Magic-link sign-in locked to the owner email
- Share from X → XBookmarks to save with text + media
- Details: [appwrite/SETUP.md](appwrite/SETUP.md)

## Scripts

| Command | Description |
|---|---|
| `pnpm build:ext` | Build extension (+ copies to Brave folders) |
| `pnpm build:android` | Build Capacitor debug APK |
| `pnpm dev:ext` | Extension watch |
| `pnpm dev:web` | PWA (needs Appwrite env) |
| `pnpm typecheck` | Typecheck |
