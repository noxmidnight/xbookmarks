import {
  createAppwriteClient,
  isAppwriteConfigComplete,
  type AppwriteConfig,
  type AppwriteServices,
} from "@xbookmarks/shared";

const raw: Partial<AppwriteConfig> = {
  endpoint:
    (import.meta.env.VITE_APPWRITE_ENDPOINT as string | undefined) ||
    "https://fra.cloud.appwrite.io/v1",
  projectId: import.meta.env.VITE_APPWRITE_PROJECT_ID as string | undefined,
  databaseId:
    (import.meta.env.VITE_APPWRITE_DATABASE_ID as string | undefined) ||
    "xbookmarks",
  foldersCollectionId:
    (import.meta.env.VITE_APPWRITE_FOLDERS_COLLECTION_ID as string | undefined) ||
    "folders",
  bookmarksCollectionId:
    (import.meta.env.VITE_APPWRITE_BOOKMARKS_COLLECTION_ID as
      | string
      | undefined) || "bookmarks",
};

export const isAppwriteConfigured = isAppwriteConfigComplete(raw);

const fallback: AppwriteConfig = {
  endpoint: "https://fra.cloud.appwrite.io/v1",
  projectId: "placeholder",
  databaseId: "xbookmarks",
  foldersCollectionId: "folders",
  bookmarksCollectionId: "bookmarks",
};

export const appwrite: AppwriteServices = createAppwriteClient(
  isAppwriteConfigured ? (raw as AppwriteConfig) : fallback,
);
