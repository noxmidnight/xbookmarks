export type FolderColor =
  | "sky"
  | "emerald"
  | "amber"
  | "rose"
  | "violet"
  | "slate"
  | "orange"
  | "teal";

export interface Folder {
  id: string;
  user_id: string;
  name: string;
  color: FolderColor;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface Bookmark {
  id: string;
  user_id: string;
  tweet_id: string;
  author_handle: string;
  author_name: string;
  text: string;
  permalink: string;
  media_urls: string[];
  bookmarked_at: string | null;
  captured_at: string;
  created_at: string;
  updated_at: string;
}

export interface BookmarkFolder {
  bookmark_id: string;
  folder_id: string;
  created_at: string;
}

export interface BookmarkWithFolders extends Bookmark {
  folder_ids: string[];
}

export interface CapturedTweet {
  tweet_id: string;
  author_handle: string;
  author_name: string;
  text: string;
  permalink: string;
  media_urls: string[];
  bookmarked_at?: string | null;
}

export interface Profile {
  id: string;
  display_name: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateFolderInput {
  name: string;
  color?: FolderColor;
  sort_order?: number;
}

export interface UpdateFolderInput {
  name?: string;
  color?: FolderColor;
  sort_order?: number;
}

export interface SaveBookmarkInput extends CapturedTweet {
  folder_ids?: string[];
}
