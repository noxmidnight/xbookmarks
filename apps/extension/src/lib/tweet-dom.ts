import type { CapturedTweet } from "@xbookmarks/shared";

/** Isolated selectors — X changes class names often; prefer roles/testids. */
export const SELECTORS = {
  tweetArticle: 'article[data-testid="tweet"]',
  bookmarkButton: '[data-testid="bookmark"], [data-testid="removeBookmark"]',
  tweetText: '[data-testid="tweetText"]',
  userName: '[data-testid="User-Name"]',
  tweetPhoto: '[data-testid="tweetPhoto"] img',
};

export function findTweetArticle(from: Element | null): HTMLElement | null {
  if (!from) return null;
  return from.closest(SELECTORS.tweetArticle) as HTMLElement | null;
}

export function extractTweetFromArticle(
  article: HTMLElement,
): CapturedTweet | null {
  const statusLink = article.querySelector(
    'a[href*="/status/"]',
  ) as HTMLAnchorElement | null;
  const href = statusLink?.href;
  if (!href) return null;

  const match = href.match(/\/status\/(\d+)/);
  const tweet_id = match?.[1];
  if (!tweet_id) return null;

  const textEl = article.querySelector(SELECTORS.tweetText);
  const text = textEl?.textContent?.trim() ?? "";

  const userBlock = article.querySelector(SELECTORS.userName);
  const links = userBlock
    ? Array.from(userBlock.querySelectorAll("a"))
    : [];
  let author_handle = "unknown";
  let author_name = "Unknown";

  for (const link of links) {
    const path = link.getAttribute("href") || "";
    if (/^\/[^/]+$/.test(path) && !path.includes("/status/")) {
      author_handle = path.slice(1);
      const nameSpan = link.querySelector("span");
      if (nameSpan?.textContent) author_name = nameSpan.textContent.trim();
      break;
    }
  }

  // Prefer display name from bold/span before handle
  const nameCandidate = userBlock?.querySelector("span span")?.textContent?.trim();
  if (nameCandidate && !nameCandidate.startsWith("@")) {
    author_name = nameCandidate;
  }

  const media_urls = Array.from(
    article.querySelectorAll(
      `${SELECTORS.tweetPhoto}, [data-testid="videoPlayer"] img, a[href*="/photo/"] img, div[aria-label="Image"] img`,
    ),
  )
    .map((img) => (img as HTMLImageElement).src)
    .filter((src) => Boolean(src) && !src.includes("profile_images"))
    .filter((src, i, arr) => arr.indexOf(src) === i);

  const permalink = `https://x.com/${author_handle}/status/${tweet_id}`;

  return {
    tweet_id,
    author_handle,
    author_name,
    text,
    permalink,
    media_urls,
    bookmarked_at: new Date().toISOString(),
  };
}

export function extractTweetsFromBookmarksPage(): CapturedTweet[] {
  const articles = Array.from(
    document.querySelectorAll(SELECTORS.tweetArticle),
  ) as HTMLElement[];
  const seen = new Set<string>();
  const out: CapturedTweet[] = [];
  for (const article of articles) {
    const tweet = extractTweetFromArticle(article);
    if (!tweet || seen.has(tweet.tweet_id)) continue;
    seen.add(tweet.tweet_id);
    out.push(tweet);
  }
  return out;
}

export function isBookmarksPage(): boolean {
  return /\/i\/bookmarks(\/|$)/.test(location.pathname);
}
