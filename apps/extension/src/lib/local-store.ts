import {
  FOLDER_COLORS,
  nextFolderColor,
  type BookmarkWithFolders,
  type CapturedTweet,
  type Folder,
  type FolderColor,
} from "@xbookmarks/shared";

const LIBRARY_KEY = "xbookmarks_library_v1";

export interface LocalLibrary {
  folders: Folder[];
  bookmarks: BookmarkWithFolders[];
}

const emptyLibrary = (): LocalLibrary => ({
  folders: [],
  bookmarks: [],
});

function nowIso() {
  return new Date().toISOString();
}

function localUserId() {
  return "local";
}

async function readLibrary(): Promise<LocalLibrary> {
  const result = await browser.storage.local.get(LIBRARY_KEY);
  const raw = result[LIBRARY_KEY] as LocalLibrary | undefined;
  if (!raw || !Array.isArray(raw.folders) || !Array.isArray(raw.bookmarks)) {
    return emptyLibrary();
  }
  return raw;
}

async function writeLibrary(library: LocalLibrary): Promise<void> {
  await browser.storage.local.set({ [LIBRARY_KEY]: library });
}

export async function localListFolders(): Promise<Folder[]> {
  const lib = await readLibrary();
  return [...lib.folders].sort(
    (a, b) => a.sort_order - b.sort_order || a.created_at.localeCompare(b.created_at),
  );
}

export async function localCreateFolder(input: {
  name: string;
  color?: FolderColor | string;
}): Promise<Folder> {
  const lib = await readLibrary();
  const name = input.name.trim();
  if (!name) throw new Error("Folder name is required");

  const color =
    (input.color as FolderColor | undefined) &&
    FOLDER_COLORS.includes(input.color as FolderColor)
      ? (input.color as FolderColor)
      : nextFolderColor(lib.folders.length);

  const folder: Folder = {
    id: crypto.randomUUID(),
    user_id: localUserId(),
    name,
    color,
    sort_order: lib.folders.length,
    created_at: nowIso(),
    updated_at: nowIso(),
  };

  lib.folders.push(folder);
  await writeLibrary(lib);
  return folder;
}

export async function localUpdateFolder(
  folderId: string,
  input: { name?: string; color?: FolderColor | string },
): Promise<Folder> {
  const lib = await readLibrary();
  const folder = lib.folders.find((f) => f.id === folderId);
  if (!folder) throw new Error("Folder not found");

  if (input.name !== undefined) {
    const name = input.name.trim();
    if (!name) throw new Error("Folder name is required");
    folder.name = name;
  }
  if (
    input.color &&
    FOLDER_COLORS.includes(input.color as FolderColor)
  ) {
    folder.color = input.color as FolderColor;
  }
  folder.updated_at = nowIso();
  await writeLibrary(lib);
  return folder;
}

export async function localDeleteFolder(folderId: string): Promise<void> {
  const lib = await readLibrary();
  lib.folders = lib.folders.filter((f) => f.id !== folderId);
  for (const bookmark of lib.bookmarks) {
    bookmark.folder_ids = bookmark.folder_ids.filter((id) => id !== folderId);
  }
  await writeLibrary(lib);
}

export async function localListBookmarks(options?: {
  folderId?: string | null;
  query?: string;
}): Promise<BookmarkWithFolders[]> {
  const lib = await readLibrary();
  let list = [...lib.bookmarks];

  if (options?.folderId) {
    list = list.filter((b) => b.folder_ids.includes(options.folderId!));
  } else if (options?.folderId === null) {
    list = list.filter((b) => b.folder_ids.length === 0);
  }

  const q = options?.query?.trim().toLowerCase();
  if (q) {
    list = list.filter((b) => {
      const hay = [b.text, b.author_handle, b.author_name, b.permalink]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }

  return list.sort((a, b) => b.captured_at.localeCompare(a.captured_at));
}

export async function localSaveBookmark(
  tweet: CapturedTweet,
  folderIds: string[] = [],
): Promise<BookmarkWithFolders> {
  const lib = await readLibrary();
  const existing = lib.bookmarks.find((b) => b.tweet_id === tweet.tweet_id);
  const stamp = nowIso();

  if (existing) {
    existing.author_handle = tweet.author_handle || existing.author_handle;
    existing.author_name = tweet.author_name || existing.author_name;
    existing.text = tweet.text || existing.text;
    existing.permalink = tweet.permalink || existing.permalink;
    existing.media_urls =
      tweet.media_urls?.length ? tweet.media_urls : existing.media_urls;
    existing.bookmarked_at = tweet.bookmarked_at ?? existing.bookmarked_at ?? stamp;
    existing.captured_at = stamp;
    existing.updated_at = stamp;
    if (folderIds.length > 0) {
      const set = new Set([...existing.folder_ids, ...folderIds]);
      existing.folder_ids = [...set];
    }
    await writeLibrary(lib);
    return existing;
  }

  const bookmark: BookmarkWithFolders = {
    id: crypto.randomUUID(),
    user_id: localUserId(),
    tweet_id: tweet.tweet_id,
    author_handle: tweet.author_handle || "unknown",
    author_name: tweet.author_name || tweet.author_handle || "Unknown",
    text: tweet.text || "",
    permalink: tweet.permalink,
    media_urls: tweet.media_urls ?? [],
    bookmarked_at: tweet.bookmarked_at ?? stamp,
    captured_at: stamp,
    created_at: stamp,
    updated_at: stamp,
    folder_ids: [...new Set(folderIds)],
  };

  lib.bookmarks.unshift(bookmark);
  await writeLibrary(lib);
  return bookmark;
}

export async function localSetBookmarkFolders(
  bookmarkId: string,
  folderIds: string[],
): Promise<void> {
  const lib = await readLibrary();
  const bookmark = lib.bookmarks.find((b) => b.id === bookmarkId);
  if (!bookmark) throw new Error("Bookmark not found");
  bookmark.folder_ids = [...new Set(folderIds)];
  bookmark.updated_at = nowIso();
  await writeLibrary(lib);
}

export async function localDeleteBookmark(bookmarkId: string): Promise<void> {
  const lib = await readLibrary();
  lib.bookmarks = lib.bookmarks.filter((b) => b.id !== bookmarkId);
  await writeLibrary(lib);
}

export async function localCountByFolder(): Promise<Record<string, number>> {
  const lib = await readLibrary();
  const counts: Record<string, number> = {};
  for (const b of lib.bookmarks) {
    for (const id of b.folder_ids) {
      counts[id] = (counts[id] ?? 0) + 1;
    }
  }
  return counts;
}

export async function localExportLibrary(): Promise<LocalLibrary> {
  return readLibrary();
}

export async function localImportLibrary(
  data: LocalLibrary,
  mode: "merge" | "replace" = "merge",
): Promise<LocalLibrary> {
  if (mode === "replace") {
    await writeLibrary({
      folders: data.folders ?? [],
      bookmarks: data.bookmarks ?? [],
    });
    return readLibrary();
  }

  const lib = await readLibrary();
  const folderById = new Map(lib.folders.map((f) => [f.id, f]));
  for (const folder of data.folders ?? []) {
    if (!folderById.has(folder.id)) {
      lib.folders.push(folder);
      folderById.set(folder.id, folder);
    }
  }

  const bookmarkByTweet = new Map(lib.bookmarks.map((b) => [b.tweet_id, b]));
  for (const bookmark of data.bookmarks ?? []) {
    const existing = bookmarkByTweet.get(bookmark.tweet_id);
    if (existing) {
      existing.folder_ids = [
        ...new Set([...existing.folder_ids, ...bookmark.folder_ids]),
      ];
      existing.updated_at = nowIso();
    } else {
      lib.bookmarks.push(bookmark);
      bookmarkByTweet.set(bookmark.tweet_id, bookmark);
    }
  }

  await writeLibrary(lib);
  return lib;
}

export async function localClearLibrary(): Promise<void> {
  await writeLibrary(emptyLibrary());
}

export { LIBRARY_KEY };
