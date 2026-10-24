import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "app.xbookmarks.mobile",
  appName: "XBookmarks",
  webDir: "dist",
  server: {
    androidScheme: "https",
  },
  android: {
    allowMixedContent: true,
  },
  plugins: {
    StatusBar: {
      style: "DARK",
      backgroundColor: "#0a0a0a",
      // Keep app + Feed WebView below the status bar (not under it).
      overlaysWebView: false,
    },
  },
};

export default config;
