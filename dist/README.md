# Build outputs

Installable / loadable artifacts only — not source.

| Folder | Product | How to use |
|---|---|---|
| [`extension/`](./extension/) | Browser extension (Brave / Chrome) | Load unpacked from this folder |
| [`android/`](./android/) | Android app | Install `XBookmarks.apk` |

Rebuild:

```bash
pnpm build:ext       # → dist/extension
pnpm build:android   # → dist/android/XBookmarks.apk
```

Mirrors are also written to `~/Downloads/XBookmarks/{extension,android}/`.
