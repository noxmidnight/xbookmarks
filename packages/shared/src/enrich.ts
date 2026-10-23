import type { CapturedTweet } from "./types";
import { classifyMediaUrl } from "./media";

interface VxTwitterMedia {
  type?: string;
  url?: string;
  thumbnail_url?: string;
}

interface VxTwitterResponse {
  text?: string;
  tweetID?: string;
  tweetURL?: string;
  user_name?: string;
  user_screen_name?: string;
  mediaURLs?: string[];
  media_extended?: VxTwitterMedia[];
  hasMedia?: boolean;
}

function collectMediaUrls(data: VxTwitterResponse): string[] {
  const out: string[] = [];
  const push = (u?: string) => {
    if (u && !out.includes(u)) out.push(u);
  };

  for (const m of data.media_extended || []) {
    const type = (m.type || "").toLowerCase();
    if (type === "video" || type === "gif") {
      // Prefer playable URL; keep thumbnail only as fallback
      push(m.url);
      if (!m.url) push(m.thumbnail_url);
    } else {
      push(m.url || m.thumbnail_url);
    }
  }

  for (const u of data.mediaURLs || []) {
    // Avoid duplicating thumbnails when we already have a video file
    if (classifyMediaUrl(u) === "image") {
      const hasVideo = out.some((x) => classifyMediaUrl(x) === "video");
      if (hasVideo && u.includes("pbs.twimg.com") && u.includes("media")) {
        // still allow photo posts; skip if this URL is clearly a video poster
        // already covered by extended entries
        const alreadyPoster = (data.media_extended || []).some(
          (m) => m.thumbnail_url === u,
        );
        if (alreadyPoster) continue;
      }
    }
    push(u);
  }

  return out;
}

/**
 * Fetch author, full text, and media (including playable video) for a tweet id.
 */
export async function enrichTweetFromId(
  tweetId: string,
  permalinkHint?: string,
): Promise<CapturedTweet> {
  const fallback: CapturedTweet = {
    tweet_id: tweetId,
    author_handle: "unknown",
    author_name: "Unknown",
    text: "",
    permalink:
      permalinkHint?.split("?")[0] || `https://x.com/i/status/${tweetId}`,
    media_urls: [],
    bookmarked_at: new Date().toISOString(),
  };

  try {
    const res = await fetch(`https://api.vxtwitter.com/i/status/${tweetId}`, {
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return fallback;

    const data = (await res.json()) as VxTwitterResponse;
    if (!data.tweetID && !data.text) return fallback;

    const handle = data.user_screen_name || "unknown";
    const permalink =
      permalinkHint?.split("?")[0] ||
      data.tweetURL?.replace("twitter.com", "x.com") ||
      `https://x.com/${handle}/status/${tweetId}`;

    return {
      tweet_id: data.tweetID || tweetId,
      author_handle: handle,
      author_name: data.user_name || handle,
      text: data.text || "",
      permalink,
      media_urls: collectMediaUrls(data),
      bookmarked_at: new Date().toISOString(),
    };
  } catch {
    return fallback;
  }
}
