import type { CapturedTweet, Folder } from "@xbookmarks/shared";
import type { LocalLibrary } from "./local-store";

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
  | { type: "IMPORT_LIBRARY"; library: LocalLibrary; mode?: "merge" | "replace" }
  | { type: "CLEAR_LIBRARY" }
  | { type: "GET_CACHED_FOLDERS" }
  | { type: "CACHE_FOLDERS"; folders: Folder[] }
  | { type: "PING_CONTENT" }
  | { type: "START_IMPORT" }
  | { type: "IMPORT_PROGRESS"; captured: number; done?: boolean; error?: string }
  // Optional cloud sync (kept for PWA later; not required for desktop)
  | { type: "GET_SESSION" }
  | { type: "SIGN_IN"; email: string }
  | { type: "SIGN_OUT" };

export type ExtensionResponse =
  | { ok: true; data?: unknown }
  | { ok: false; error: string };
