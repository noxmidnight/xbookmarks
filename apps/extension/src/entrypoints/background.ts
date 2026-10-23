import type { FolderColor } from "@xbookmarks/shared";
import { isAppwriteConfigured } from "../lib/appwrite";
import {
  clearCloudSession,
  cloudCountByFolder,
  cloudCreateFolder,
  cloudDeleteBookmark,
  cloudDeleteFolder,
  cloudExportLibrary,
  cloudListBookmarks,
  cloudListFolders,
  cloudRequestOtp,
  cloudSaveBookmark,
  cloudSetBookmarkFolders,
  cloudUpdateFolder,
  cloudVerifyOtp,
  getCloudAccount,
  loadCloudSession,
  refreshFromCloud,
  wipeLocalLibrary,
} from "../lib/cloud-sync";
import type { ExtensionMessage, ExtensionResponse } from "../lib/messages";

export default defineBackground(() => {
  void (async () => {
    await loadCloudSession().catch(() => undefined);
    // One-time: stop serving stale local folders after upgrading to Appwrite-only.
    await wipeLocalLibrary().catch(() => undefined);
  })();

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
    case "GET_STORAGE_MODE": {
      const account = await getCloudAccount();
      return {
        ok: true,
        data: {
          mode: account ? "cloud" : "signed_out",
          cloudConfigured: isAppwriteConfigured,
          email: account?.email ?? null,
        },
      };
    }

    case "LIST_FOLDERS":
    case "GET_CACHED_FOLDERS": {
      const folders = await cloudListFolders();
      return { ok: true, data: folders };
    }

    case "CACHE_FOLDERS":
      return { ok: true };

    case "CREATE_FOLDER": {
      const folder = await cloudCreateFolder({
        name: message.name,
        color: message.color,
      });
      return { ok: true, data: folder };
    }

    case "UPDATE_FOLDER": {
      const folder = await cloudUpdateFolder(message.folderId, {
        name: message.name,
        color: message.color as FolderColor | undefined,
      });
      return { ok: true, data: folder };
    }

    case "DELETE_FOLDER": {
      await cloudDeleteFolder(message.folderId);
      return { ok: true };
    }

    case "LIST_BOOKMARKS": {
      const bookmarks = await cloudListBookmarks({
        folderId: message.folderId,
        query: message.query,
      });
      return { ok: true, data: bookmarks };
    }

    case "SAVE_BOOKMARK": {
      const saved = await cloudSaveBookmark(message.tweet, message.folderIds);
      return { ok: true, data: saved };
    }

    case "SET_BOOKMARK_FOLDERS": {
      await cloudSetBookmarkFolders(message.bookmarkId, message.folderIds);
      return { ok: true };
    }

    case "DELETE_BOOKMARK": {
      await cloudDeleteBookmark(message.bookmarkId);
      return { ok: true };
    }

    case "COUNT_BY_FOLDER": {
      const counts = await cloudCountByFolder();
      return { ok: true, data: counts };
    }

    case "EXPORT_LIBRARY": {
      const library = await cloudExportLibrary();
      return { ok: true, data: library };
    }

    case "IMPORT_LIBRARY": {
      // Legacy local import is disabled — data lives in Appwrite only.
      return {
        ok: false,
        error: "Import JSON into Appwrite is not supported from the extension. Use the phone app or create folders after signing in.",
      };
    }

    case "CLEAR_LIBRARY": {
      // Cloud-only: clear leftover local cache only (does not delete Appwrite rows).
      await wipeLocalLibrary();
      return { ok: true };
    }

    case "GET_SESSION": {
      const account = await getCloudAccount();
      return { ok: true, data: account };
    }

    case "CLOUD_REQUEST_OTP": {
      const userId = await cloudRequestOtp(message.email);
      return { ok: true, data: { userId } };
    }

    case "CLOUD_VERIFY_OTP": {
      const session = await cloudVerifyOtp(
        message.userId,
        message.secret,
        message.email,
      );
      const sync = await refreshFromCloud();
      return { ok: true, data: { session, sync } };
    }

    case "SIGN_OUT": {
      await clearCloudSession();
      await wipeLocalLibrary();
      return { ok: true };
    }

    case "SYNC_NOW": {
      const sync = await refreshFromCloud();
      return { ok: true, data: sync };
    }

    case "PING_CONTENT":
      return { ok: true, data: "pong" };

    default:
      return { ok: false, error: "Unknown message" };
  }
}
