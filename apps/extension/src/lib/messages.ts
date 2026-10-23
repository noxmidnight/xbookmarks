import type { CapturedTweet, Folder } from "@xbookmarks/shared";

export type ExtensionMessage =
  | { type: "GET_STORAGE_MODE" }
  | { type: "LIST_FOLDERS" }
  | { type: "CREATE_FOLDER"; name: string; color?: string }
  | { type: "UPDATE_FOLDER"; folderId: string; name?: string; color?: string }
  | { type: "DELETE_FOLDER"; folderId: string }
  | { type: "LIST_BOOKMARKS"; folderId?: string | null; query?: string }
  | { type: "SAVE_BOOKMARK"; tweet: CapturedTweet; folderIds: string[] }
  | { type: "SET_BOOKMARK_FOLDERS"; bookmarkId: string; folderIds: string[] }
  | { type: "DELETE_BOOKMARK"; bookmarkId: string }
  | { type: "COUNT_BY_FOLDER" }
  | { type: "EXPORT_LIBRARY" }
  | {
      type: "IMPORT_LIBRARY";
      library: { folders: Folder[]; bookmarks: unknown[] };
      mode?: "merge" | "replace";
    }
  | { type: "CLEAR_LIBRARY" }
  | { type: "GET_CACHED_FOLDERS" }
  | { type: "CACHE_FOLDERS"; folders: Folder[] }
  | { type: "PING_CONTENT" }
  | { type: "START_IMPORT" }
  | { type: "IMPORT_PROGRESS"; captured: number; done?: boolean; error?: string }
  | { type: "GET_SESSION" }
  | { type: "CLOUD_REQUEST_OTP"; email: string }
  | { type: "CLOUD_VERIFY_OTP"; userId: string; secret: string; email: string }
  | { type: "SIGN_OUT" }
  | { type: "SYNC_NOW" };

export type ExtensionResponse =
  | { ok: true; data?: unknown }
  | { ok: false; error: string };
