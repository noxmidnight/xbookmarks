import { useCallback, useEffect, useState } from "react";
import {
  countBookmarksByFolder,
  listBookmarks,
  listFolders,
  type BookmarkWithFolders,
  type Folder,
} from "@xbookmarks/shared";
import { appwrite } from "../lib/appwrite";

export function useFolders() {
  const [folders, setFolders] = useState<Folder[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [nextFolders, nextCounts] = await Promise.all([
        listFolders(appwrite),
        countBookmarksByFolder(appwrite),
      ]);
      setFolders(nextFolders);
      setCounts(nextCounts);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load folders");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { folders, counts, loading, error, refresh };
}

export function useBookmarks(options?: {
  folderId?: string | null;
  query?: string;
}) {
  const [bookmarks, setBookmarks] = useState<BookmarkWithFolders[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listBookmarks(appwrite, options);
      setBookmarks(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load bookmarks");
    } finally {
      setLoading(false);
    }
  }, [options?.folderId, options?.query]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { bookmarks, loading, error, refresh };
}
