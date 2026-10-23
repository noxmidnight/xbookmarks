import type { FolderColor } from "@xbookmarks/shared";
import {
  localClearLibrary,
  localCountByFolder,
  localCreateFolder,
  localDeleteBookmark,
  localDeleteFolder,
  localExportLibrary,
  localImportLibrary,
  localListBookmarks,
  localListFolders,
  localSaveBookmark,
  localSetBookmarkFolders,
  localUpdateFolder,
} from "../lib/local-store";
import { isAppwriteConfigured } from "../lib/appwrite";
import type { ExtensionMessage, ExtensionResponse } from "../lib/messages";

export default defineBackground(() => {
  browser.runtime.onMessage.addListener(
    (message: ExtensionMessage, _sender, sendResponse) => {
      void handleMessage(message)
        .then(sendResponse)
        .catch((err: unknown) => {
          sendResponse({
            ok: false,
            error: err instanceof Error ? err.message : "Unknown error",
          } satisfies ExtensionResponse);
        });
      return true;
    },
  );
});

async function handleMessage(
  message: ExtensionMessage,
): Promise<ExtensionResponse> {
  switch (message.type) {
    case "GET_STORAGE_MODE":
      return {
        ok: true,
        data: { mode: "local", cloudConfigured: isAppwriteConfigured },
      };

    case "LIST_FOLDERS": {
      const folders = await localListFolders();
      return { ok: true, data: folders };
    }

    case "GET_CACHED_FOLDERS": {
      const folders = await localListFolders();
      return { ok: true, data: folders };
    }

    case "CACHE_FOLDERS":
      return { ok: true };

    case "CREATE_FOLDER": {
      const folder = await localCreateFolder({
        name: message.name,
        color: message.color,
      });
      return { ok: true, data: folder };
    }

    case "UPDATE_FOLDER": {
      const folder = await localUpdateFolder(message.folderId, {
        name: message.name,
        color: message.color as FolderColor | undefined,
      });
      return { ok: true, data: folder };
    }

    case "DELETE_FOLDER": {
      await localDeleteFolder(message.folderId);
      return { ok: true };
    }

    case "LIST_BOOKMARKS": {
      const bookmarks = await localListBookmarks({
        folderId: message.folderId,
        query: message.query,
      });
      return { ok: true, data: bookmarks };
    }

    case "SAVE_BOOKMARK": {
      const saved = await localSaveBookmark(message.tweet, message.folderIds);
      return { ok: true, data: saved };
    }

    case "SET_BOOKMARK_FOLDERS": {
      await localSetBookmarkFolders(message.bookmarkId, message.folderIds);
      return { ok: true };
    }

    case "DELETE_BOOKMARK": {
      await localDeleteBookmark(message.bookmarkId);
      return { ok: true };
    }

    case "COUNT_BY_FOLDER": {
      const counts = await localCountByFolder();
      return { ok: true, data: counts };
    }

    case "EXPORT_LIBRARY": {
      const library = await localExportLibrary();
      return { ok: true, data: library };
    }

    case "IMPORT_LIBRARY": {
      const library = await localImportLibrary(
        message.library,
        message.mode ?? "merge",
      );
      return { ok: true, data: library };
    }

    case "CLEAR_LIBRARY": {
      await localClearLibrary();
      return { ok: true };
    }

    // Optional Appwrite cloud helpers (PWA sync). Desktop stays local-first.
    case "GET_SESSION":
      return { ok: true, data: null };

    case "SIGN_IN":
      return {
        ok: false,
        error: "Use the PWA magic link, then paste a JWT into the extension.",
      };

    case "SIGN_OUT":
      return { ok: true };

    case "PING_CONTENT":
      return { ok: true, data: "pong" };

    default:
      return { ok: false, error: "Unknown message" };
  }
}
