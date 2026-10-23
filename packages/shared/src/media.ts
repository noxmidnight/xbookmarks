export type MediaKind = "image" | "video" | "gif";

export interface MediaItem {
  kind: MediaKind;
  url: string;
  poster?: string;
}

/** Detect playable / displayable media from a stored URL. */
export function classifyMediaUrl(url: string): MediaKind {
  const u = url.toLowerCase();
  if (
    u.includes("ext_tw_video") ||
    u.includes("video.twimg.com") ||
    u.includes("/amplify_video/") ||
    u.includes(".mp4") ||
    u.includes(".m3u8") ||
    u.includes("tweet_video")
  ) {
    return "video";
  }
  if (u.includes("tweet_gif") || u.includes(".gif")) {
    return "gif";
  }
  return "image";
}

export function urlsToMediaItems(urls: string[]): MediaItem[] {
  const items: MediaItem[] = [];
  const seen = new Set<string>();
  for (const url of urls) {
    if (!url || seen.has(url)) continue;
    seen.add(url);
    items.push({ kind: classifyMediaUrl(url), url });
  }
  return items;
}
