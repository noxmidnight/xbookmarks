# Appwrite setup for XBookmarks

Desktop extension works **locally without Appwrite**. Cloud is for the private phone PWA.

## Live PWA

| Field | Value |
|---|---|
| URL | https://xbookmarks.appwrite.network |
| Site ID | `xbookmarks-pwa` |
| Access | Owner only (set `VITE_OWNER_EMAIL`) |

**Preferred on Android:** sideload the Capacitor APK (`~/Downloads/XBookmarks.apk`) — in-app Feed + Folders. See [apps/web/ANDROID.md](../apps/web/ANDROID.md).

Optional PWA: open the URL in Brave/Chrome → menu → **Install app** / Add to Home screen.

Share from X: Share → **XBookmarks** → pick folder (captures text + media via enrichment).

Appwrite platforms registered for the Android package `app.xbookmarks.mobile` and Capacitor hostname `localhost`.

## Project

| Field | Value |
|---|---|
| Name | XBookmarks |
| Project ID | `6ad97864000c4df7e935` |
| Region endpoint | `https://fra.cloud.appwrite.io/v1` |
| Database | `xbookmarks` (TablesDB) |
| Tables | `folders`, `bookmarks` |
| User limit | **1** (no new signups) |

## Redeploy

```bash
pnpm build:web
# tar dist and POST to Sites API, or use Appwrite Console → Sites → Deploy
```

Env for local/dev: `apps/web/.env` (`VITE_OWNER_EMAIL`, Appwrite IDs).
