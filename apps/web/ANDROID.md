# XBookmarks Android (Capacitor)

Personal sideload APK: in-app **X feed** + **Folders** without Share-sheet switching.

## Install on your phone

**Easiest:** download from GitHub Releases  
https://github.com/noxmidnight/xbookmarks/releases/latest  
→ **XBookmarks.apk** → allow **Install unknown apps** if prompted → Install.

Or copy `dist/android/XBookmarks.apk` (also mirrored to `~/Downloads/XBookmarks/android/`) via USB / Nearby Share / Drive.
3. Open **XBookmarks**.
4. Sign in with your owner email → **Email me a code** → enter the 6-digit code from email.
5. Tap **Feed** → log into X once inside the in-app browser.
   - Prefer **username & password** or **Apple** — Google Sign-In is blocked inside app WebViews (the “clear Chrome cookies” page). Clearing Chrome will not fix that.
   - If stuck: **Settings → Reset Feed login**, then sign in with username/password.
6. Open a tweet → tap **Bookmark** (strip under the feed, or the toolbar bookmark) → pick folder(s) → **Save**.
7. Check **Folders** / **All** for the saved post.

### USB install (from this PC)

1. Phone: enable **Developer options** → **USB debugging**.
2. Plug in USB, accept the prompt.
3. On the PC:

```bash
adb install -r dist/android/XBookmarks.apk
```

## Rebuild after code changes

```bash
export JAVA_HOME="$HOME/.local/jdk-21"
export ANDROID_HOME="$HOME/Android/Sdk"
pnpm build:android
# → dist/android/XBookmarks.apk
# → ~/Downloads/XBookmarks/android/XBookmarks.apk
```

Requires JDK 21 at `~/.local/jdk-21` and Android SDK at `~/Android/Sdk` (already set up on this machine).

## Notes

- Save works on an **opened tweet** URL (`…/status/…`), not a card still on Home.
- X login lives in the feed WebView (separate from Chrome). Sign in once inside **Feed**.
- Bookmark reads the live WebView URL (SPA-safe). Prefer opening the tweet, then Bookmark.
- The browser PWA + Share target still work; this APK is the single-app feed path.

## If something fails

| Symptom | Fix |
|---|---|
| OTP email never arrives | Check spam; confirm Appwrite email is enabled for the project |
| X shows “browser not supported” | Reinstall latest APK (uses Chrome mobile user-agent) |
| Bookmark says open a tweet | Open the post so the address is `…/status/…`, then tap Bookmark |
| Saved but missing media/text | Tap Refresh on the bookmark card in Folders |
| App won’t install | Enable Install unknown apps for Files/Drive/Chrome |
