import {
  countBookmarksByFolder,
  createFolder,
  deleteBookmark,
  deleteFolder,
  listBookmarks,
  listFolders,
  saveBookmark,
  setBookmarkFolders,
  updateFolder,
  type BookmarkWithFolders,
  type CapturedTweet,
  type Folder,
  type FolderColor,
} from "@xbookmarks/shared";
import { ID } from "appwrite";
import { appwrite, isAppwriteConfigured } from "./appwrite";
import { localClearLibrary } from "./local-store";

const SESSION_KEY = "xbookmarks_appwrite_session_v1";

export interface CloudSession {
  secret: string;
  userId: string;
  email: string;
}

export interface SyncResult {
  folders: number;
  bookmarks: number;
  pushedFolders: number;
  pushedBookmarks: number;
}

export async function loadCloudSession(): Promise<CloudSession | null> {
  if (!isAppwriteConfigured) return null;
  const result = await browser.storage.local.get(SESSION_KEY);
  const session = result[SESSION_KEY] as CloudSession | undefined;
  if (!session?.secret) return null;
  appwrite.client.setSession(session.secret);
  return session;
}

export async function clearCloudSession(): Promise<void> {
  try {
    await loadCloudSession();
    await appwrite.account.deleteSession("current");
  } catch {
    // ignore
  }
  await browser.storage.local.remove(SESSION_KEY);
}

export async function getCloudAccount(): Promise<{
  email: string;
  userId: string;
} | null> {
  const session = await loadCloudSession();
  if (!session) return null;
  try {
    const user = await appwrite.account.get();
    return { email: user.email, userId: user.$id };
  } catch {
    await browser.storage.local.remove(SESSION_KEY);
    return null;
  }
}

export async function cloudRequestOtp(email: string): Promise<string> {
  if (!isAppwriteConfigured) {
    throw new Error("Appwrite is not configured in the extension build.");
  }
  const token = await appwrite.account.createEmailToken(
    ID.unique(),
    email.trim(),
  );
  return token.userId;
}

export async function cloudVerifyOtp(
  userId: string,
  secret: string,
  email: string,
): Promise<CloudSession> {
  const session = await appwrite.account.createSession(userId, secret.trim());
  const stored: CloudSession = {
    secret: session.secret,
    userId: session.userId,
    email: email.trim().toLowerCase(),
  };
  await browser.storage.local.set({ [SESSION_KEY]: stored });
  appwrite.client.setSession(stored.secret);
  // Drop legacy local library so the UI never shows stale desktop-only folders.
  await localClearLibrary();
  return stored;
}

async function ensureSession(): Promise<CloudSession> {
  const session = await loadCloudSession();
  if (!session) {
    throw new Error("Sign in with Appwrite (popup → email code) to use XBookmarks.");
  }
  await appwrite.account.get();
  return session;
}

/** Wipe leftover chrome.storage library (session keys kept). */
export async function wipeLocalLibrary(): Promise<void> {
  await localClearLibrary();
}

export async function cloudListFolders(): Promise<Folder[]> {
  await ensureSession();
  return listFolders(appwrite);
}

export async function cloudCreateFolder(input: {
  name: string;
  color?: FolderColor | string;
}): Promise<Folder> {
  await ensureSession();
  return createFolder(appwrite, {
    name: input.name,
    color: input.color as FolderColor | undefined,
  });
}

export async function cloudUpdateFolder(
  folderId: string,
  input: { name?: string; color?: FolderColor | string },
): Promise<Folder> {
  await ensureSession();
  return updateFolder(appwrite, folderId, {
    name: input.name,
    color: input.color as FolderColor | undefined,
  });
}

export async function cloudDeleteFolder(folderId: string): Promise<void> {
  await ensureSession();
  await deleteFolder(appwrite, folderId);
}

export async function cloudListBookmarks(options?: {
  folderId?: string | null;
  query?: string;
}): Promise<BookmarkWithFolders[]> {
  await ensureSession();
  return listBookmarks(appwrite, options);
}

export async function cloudSaveBookmark(
  tweet: CapturedTweet,
  folderIds: string[] = [],
): Promise<BookmarkWithFolders> {
  await ensureSession();
  return saveBookmark(appwrite, {
    tweet_id: tweet.tweet_id,
    author_handle: tweet.author_handle,
    author_name: tweet.author_name,
    text: tweet.text,
    permalink: tweet.permalink,
    media_urls: tweet.media_urls,
    bookmarked_at: tweet.bookmarked_at,
    folder_ids: folderIds,
  });
}

export async function cloudSetBookmarkFolders(
  bookmarkId: string,
  folderIds: string[],
): Promise<void> {
  await ensureSession();
  await setBookmarkFolders(appwrite, bookmarkId, folderIds);
}

export async function cloudDeleteBookmark(bookmarkId: string): Promise<void> {
  await ensureSession();
  await deleteBookmark(appwrite, bookmarkId);
}

export async function cloudCountByFolder(): Promise<Record<string, number>> {
  await ensureSession();
  return countBookmarksByFolder(appwrite);
}

export async function cloudExportLibrary(): Promise<{
  folders: Folder[];
  bookmarks: BookmarkWithFolders[];
}> {
  await ensureSession();
  const [folders, bookmarks] = await Promise.all([
    listFolders(appwrite),
    listBookmarks(appwrite),
  ]);
  return { folders, bookmarks };
}

/** Refresh counts from Appwrite (no local mirror). */
export async function refreshFromCloud(): Promise<SyncResult> {
  await ensureSession();
  await wipeLocalLibrary();
  const [folders, bookmarks] = await Promise.all([
    listFolders(appwrite),
    listBookmarks(appwrite),
  ]);
  return {
    folders: folders.length,
    bookmarks: bookmarks.length,
    pushedFolders: 0,
    pushedBookmarks: 0,
  };
}
