# XBookmarks

Premium-style **bookmark folders** for X — without X Premium.

```
XBookmarks/
  apps/extension    Browser extension (Brave / Chrome)
  apps/web          Phone PWA + Capacitor Android app
  packages/shared   Shared types + Appwrite API
  appwrite/         Cloud setup notes
  dist/
    extension/      ← load unpacked in Brave
    android/        ← XBookmarks.apk
```

Source for the two products stays separate under `apps/`. Installable builds land in **`dist/extension`** and **`dist/android`** only (nothing dumped at the repo root).

## Desktop — browser extension

```bash
pnpm install
pnpm build:ext
```

Load unpacked in Brave from:

- `dist/extension`, or
- `~/Downloads/XBookmarks/extension`

Reload `x.com` → gold **XBookmarks** in the left nav. Open the popup → sign in with the same Appwrite email as the phone → folders sync from the cloud.

## Phone — Android app

```bash
pnpm build:android
```

Install:

- `dist/android/XBookmarks.apk`, or
- `~/Downloads/XBookmarks/android/XBookmarks.apk`

Or from [GitHub Releases](https://github.com/noxmidnight/xbookmarks/releases). Full steps: [apps/web/ANDROID.md](apps/web/ANDROID.md).

## Phone PWA (optional)

Live: **https://xbookmarks.appwrite.network** — see [appwrite/SETUP.md](appwrite/SETUP.md).

## Scripts

| Command | Description |
|---|---|
| `pnpm build:ext` | Build extension → `dist/extension` |
| `pnpm build:android` | Build APK → `dist/android` |
| `pnpm dev:ext` | Extension watch |
| `pnpm dev:web` | PWA (needs Appwrite env) |
| `pnpm typecheck` | Typecheck |
