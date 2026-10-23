/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  readonly VITE_APPWRITE_ENDPOINT?: string;
  readonly VITE_APPWRITE_PROJECT_ID: string;
  readonly VITE_APPWRITE_DATABASE_ID?: string;
  readonly VITE_APPWRITE_FOLDERS_COLLECTION_ID?: string;
  readonly VITE_APPWRITE_BOOKMARKS_COLLECTION_ID?: string;
  readonly VITE_PWA_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
