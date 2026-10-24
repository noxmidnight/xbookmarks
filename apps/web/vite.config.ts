import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import path from "node:path";

export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    VitePWA({
      // Inside the APK a caching service worker keeps serving the previous
      // bundle after an update; ship one that unregisters itself instead.
      selfDestroying: mode === "capacitor",
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg", "icons/*.png"],
      manifest: {
        name: "XBookmarks",
        short_name: "XBookmarks",
        description: "Private X bookmark folders",
        theme_color: "#0a0a0a",
        background_color: "#0a0a0a",
        display: "standalone",
        orientation: "portrait-primary",
        start_url: "/",
        scope: "/",
        icons: [
          {
            src: "/icons/icon-192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "/icons/icon-512.png",
            sizes: "512x512",
            type: "image/png",
          },
          {
            src: "/icons/icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
        share_target: {
          action: "/share",
          method: "GET",
          enctype: "application/x-www-form-urlencoded",
          params: {
            title: "title",
            text: "text",
            url: "url",
          },
        },
        categories: ["productivity", "social"],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/.*\.cloud\.appwrite\.io\/.*/i,
            handler: "NetworkFirst",
            options: {
              cacheName: "appwrite-api",
              expiration: {
                maxEntries: 64,
                maxAgeSeconds: 60 * 60,
              },
            },
          },
          {
            urlPattern: /^https:\/\/api\.vxtwitter\.com\/.*/i,
            handler: "NetworkFirst",
            options: {
              cacheName: "tweet-enrich",
              expiration: {
                maxEntries: 128,
                maxAgeSeconds: 60 * 60 * 24,
              },
            },
          },
          {
            urlPattern: /^https:\/\/pbs\.twimg\.com\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "tweet-media",
              expiration: {
                maxEntries: 256,
                maxAgeSeconds: 60 * 60 * 24 * 7,
              },
            },
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      "@xbookmarks/shared": path.resolve(__dirname, "../../packages/shared/src"),
    },
  },
  server: {
    port: 5173,
  },
}));
