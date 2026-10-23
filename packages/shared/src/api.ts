import { ID, Permission, Query, Role, type Models } from "appwrite";
import type { AppwriteServices } from "./appwrite";
import type {
  BookmarkWithFolders,
  CreateFolderInput,
  Folder,
  FolderColor,
  SaveBookmarkInput,
  UpdateFolderInput,
} from "./types";
import { nextFolderColor } from "./colors";

type Services = AppwriteServices;

type FolderRow = Models.Row & {
  user_id: string;
  name: string;
  color: string;
  sort_order: number;
};

type BookmarkRow = Models.Row & {
  user_id: string;
  tweet_id: string;
  author_handle: string;
  author_name: string;
  text: string;
  permalink: string;
  media_urls: string[];
  folder_ids: string[];
  bookmarked_at: string | null;
  captured_at: string;
};

async function requireUserId(services: Services): Promise<string> {
  const user = await services.account.get();
  return user.$id;
}

function mapFolder(row: FolderRow): Folder {
  return {
    id: row.$id,
    user_id: row.user_id,
    name: row.name,
    color: row.color as FolderColor,
    sort_order: row.sort_order,
    created_at: row.$createdAt,
    updated_at: row.$updatedAt,
  };
}

/** TablesDB may return columns top-level or nested under `data`. */
function col<T>(row: Record<string, unknown>, key: string): T | undefined {
  if (row[key] !== undefined && row[key] !== null) return row[key] as T;
  const nested = row.data as Record<string, unknown> | undefined;
  if (nested && nested[key] !== undefined && nested[key] !== null) {
    return nested[key] as T;
  }
  return undefined;
}

function mapBookmark(row: BookmarkRow): BookmarkWithFolders {
  const r = row as unknown as Record<string, unknown>;
  const media = col<string[]>(r, "media_urls");
  const folders = col<string[]>(r, "folder_ids");
  return {
    id: row.$id,
    user_id: col<string>(r, "user_id") || "",
    tweet_id: col<string>(r, "tweet_id") || "",
    author_handle: col<string>(r, "author_handle") || "unknown",
    author_name: col<string>(r, "author_name") || "Unknown",
    text: col<string>(r, "text") || "",
    permalink: col<string>(r, "permalink") || "",
    media_urls: Array.isArray(media) ? media : [],
    bookmarked_at: col<string | null>(r, "bookmarked_at") ?? null,
    captured_at: col<string>(r, "captured_at") || row.$createdAt,
    created_at: row.$createdAt,
    updated_at: row.$updatedAt,
    folder_ids: Array.isArray(folders) ? folders : [],
  };
}

function ownerPerms(userId: string) {
  return [
    Permission.read(Role.user(userId)),
    Permission.update(Role.user(userId)),
    Permission.delete(Role.user(userId)),
  ];
}

export async function listFolders(services: Services): Promise<Folder[]> {
  const userId = await requireUserId(services);
  const { databaseId, foldersCollectionId } = services.config;
  const result = await services.tables.listRows({
    databaseId,
    tableId: foldersCollectionId,
    queries: [
      Query.equal("user_id", userId),
      Query.orderAsc("sort_order"),
      Query.limit(100),
    ],
  });
  return (result.rows as unknown as FolderRow[]).map(mapFolder);
}

export async function createFolder(
  services: Services,
  input: CreateFolderInput,
): Promise<Folder> {
  const userId = await requireUserId(services);
  const existing = await listFolders(services);
  const color = input.color ?? nextFolderColor(existing.length);
  const sort_order = input.sort_order ?? existing.length;
  const { databaseId, foldersCollectionId } = services.config;

  const row = (await services.tables.createRow({
    databaseId,
    tableId: foldersCollectionId,
    rowId: ID.unique(),
    data: {
      user_id: userId,
      name: input.name.trim(),
      color,
      sort_order,
    },
    permissions: ownerPerms(userId),
  })) as unknown as FolderRow;
  return mapFolder(row);
}

export async function updateFolder(
  services: Services,
  folderId: string,
  input: UpdateFolderInput,
): Promise<Folder> {
  const { databaseId, foldersCollectionId } = services.config;
  const payload: Record<string, unknown> = {};
  if (input.name !== undefined) payload.name = input.name.trim();
  if (input.color !== undefined) payload.color = input.color;
  if (input.sort_order !== undefined) payload.sort_order = input.sort_order;

  const row = (await services.tables.updateRow({
    databaseId,
    tableId: foldersCollectionId,
    rowId: folderId,
    data: payload,
  })) as unknown as FolderRow;
  return mapFolder(row);
}

export async function deleteFolder(
  services: Services,
  folderId: string,
): Promise<void> {
  const userId = await requireUserId(services);
  const { databaseId, foldersCollectionId, bookmarksCollectionId } =
    services.config;

  const linked = await services.tables.listRows({
    databaseId,
    tableId: bookmarksCollectionId,
    queries: [
      Query.equal("user_id", userId),
      Query.contains("folder_ids", folderId),
      Query.limit(100),
    ],
  });

  await Promise.all(
    (linked.rows as unknown as BookmarkRow[]).map((b) =>
      services.tables.updateRow({
        databaseId,
        tableId: bookmarksCollectionId,
        rowId: b.$id,
        data: {
          folder_ids: (b.folder_ids || []).filter((id) => id !== folderId),
        },
      }),
    ),
  );

  await services.tables.deleteRow({
    databaseId,
    tableId: foldersCollectionId,
    rowId: folderId,
  });
}

export async function listBookmarks(
  services: Services,
  options?: { folderId?: string | null; query?: string },
): Promise<BookmarkWithFolders[]> {
  const userId = await requireUserId(services);
  const { databaseId, bookmarksCollectionId } = services.config;

  const queries = [
    Query.equal("user_id", userId),
    Query.orderDesc("captured_at"),
    Query.limit(200),
  ];

  if (options?.folderId) {
    queries.push(Query.contains("folder_ids", options.folderId));
  }

  const result = await services.tables.listRows({
    databaseId,
    tableId: bookmarksCollectionId,
    queries,
  });

  let bookmarks = (result.rows as unknown as BookmarkRow[]).map(mapBookmark);

  if (options?.folderId === null) {
    bookmarks = bookmarks.filter((b) => b.folder_ids.length === 0);
  }

  const q = options?.query?.trim().toLowerCase();
  if (q) {
    bookmarks = bookmarks.filter((b) => {
      const hay = [b.text, b.author_handle, b.author_name, b.permalink]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }

  return bookmarks;
}

export async function saveBookmark(
  services: Services,
  input: SaveBookmarkInput,
): Promise<BookmarkWithFolders> {
  const userId = await requireUserId(services);
  const { databaseId, bookmarksCollectionId } = services.config;
  const stamp = new Date().toISOString();

  const existing = await services.tables.listRows({
    databaseId,
    tableId: bookmarksCollectionId,
    queries: [
      Query.equal("user_id", userId),
      Query.equal("tweet_id", input.tweet_id),
      Query.limit(1),
    ],
  });

  const folderIds = input.folder_ids ?? [];
  const prev = existing.rows[0] as unknown as BookmarkRow | undefined;

  if (prev) {
    const mergedFolders =
      folderIds.length > 0
        ? [...new Set([...(prev.folder_ids || []), ...folderIds])]
        : prev.folder_ids || [];

    const row = (await services.tables.updateRow({
      databaseId,
      tableId: bookmarksCollectionId,
      rowId: prev.$id,
      data: {
        author_handle: input.author_handle || prev.author_handle,
        author_name: input.author_name || prev.author_name,
        text:
          (input.text?.length || 0) >= (prev.text?.length || 0)
            ? input.text || prev.text
            : prev.text || input.text || "",
        permalink: input.permalink || prev.permalink,
        media_urls:
          (input.media_urls?.length || 0) >= (prev.media_urls?.length || 0) &&
          (input.media_urls?.length || 0) > 0
            ? input.media_urls!
            : input.media_urls?.length
              ? input.media_urls
              : prev.media_urls,
        bookmarked_at: input.bookmarked_at ?? prev.bookmarked_at ?? stamp,
        captured_at: stamp,
        folder_ids: mergedFolders,
      },
    })) as unknown as BookmarkRow;
    return mapBookmark(row);
  }

  const row = (await services.tables.createRow({
    databaseId,
    tableId: bookmarksCollectionId,
    rowId: ID.unique(),
    data: {
      user_id: userId,
      tweet_id: input.tweet_id,
      author_handle: input.author_handle || "unknown",
      author_name: input.author_name || input.author_handle || "Unknown",
      text: input.text || "",
      permalink: input.permalink,
      media_urls: input.media_urls ?? [],
      folder_ids: [...new Set(folderIds)],
      bookmarked_at: input.bookmarked_at ?? stamp,
      captured_at: stamp,
    },
    permissions: ownerPerms(userId),
  })) as unknown as BookmarkRow;
  return mapBookmark(row);
}

export async function setBookmarkFolders(
  services: Services,
  bookmarkId: string,
  folderIds: string[],
): Promise<void> {
  const { databaseId, bookmarksCollectionId } = services.config;
  await services.tables.updateRow({
    databaseId,
    tableId: bookmarksCollectionId,
    rowId: bookmarkId,
    data: { folder_ids: [...new Set(folderIds)] },
  });
}

export async function deleteBookmark(
  services: Services,
  bookmarkId: string,
): Promise<void> {
  const { databaseId, bookmarksCollectionId } = services.config;
  await services.tables.deleteRow({
    databaseId,
    tableId: bookmarksCollectionId,
    rowId: bookmarkId,
  });
}

export async function countBookmarksByFolder(
  services: Services,
): Promise<Record<string, number>> {
  const bookmarks = await listBookmarks(services);
  const counts: Record<string, number> = {};
  for (const b of bookmarks) {
    for (const id of b.folder_ids) {
      counts[id] = (counts[id] ?? 0) + 1;
    }
  }
  return counts;
}

export function extractTweetIdFromUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    const match = parsed.pathname.match(/\/status\/(\d+)/);
    return match?.[1] ?? null;
  } catch {
    return null;
  }
}
