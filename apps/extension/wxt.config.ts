import { defineConfig } from "wxt";
import path from "node:path";

export default defineConfig({
  srcDir: "src",
  publicDir: "public",
  modules: ["@wxt-dev/module-react"],
  manifest: {
    name: "XBookmarks",
    description:
      "Premium-style bookmark folders for X — syncs with the XBookmarks PWA",
    version: "0.1.0",
    permissions: ["storage", "tabs", "activeTab"],
    host_permissions: [
      "*://x.com/*",
      "*://twitter.com/*",
      "https://*.appwrite.io/*",
      "https://cloud.appwrite.io/*",
      "https://fra.cloud.appwrite.io/*",
    ],
    action: {
      default_title: "XBookmarks",
    },
    icons: {
      16: "icon/16.png",
      48: "icon/48.png",
      128: "icon/128.png",
    },
  },
  vite: () => ({
    resolve: {
      alias: {
        "@xbookmarks/shared": path.resolve(
          __dirname,
          "../../packages/shared/src",
        ),
      },
    },
  }),
});
