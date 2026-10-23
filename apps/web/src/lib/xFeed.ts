import { Capacitor, type PluginListenerHandle } from "@capacitor/core";
import {
  BackgroundColor,
  CloseAction,
  InAppBrowser,
  ToolBarType,
} from "@capgo/capacitor-inappbrowser";
import { extractTweetIdFromUrl } from "@xbookmarks/shared";

export const X_FEED_URL = "https://x.com/home";
/** Bottom tab bar + feed action strip (must stay above the native WebView). */
export const FEED_BOTTOM_RESERVE_PX = 140;

/** Chrome Android UA — X often rejects the default WebView user-agent. */
const CHROME_MOBILE_UA =
  "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36";

const URL_HOOK_SCRIPT = `
(function () {
  if (window.__xbookmarksUrlHook) return;
  window.__xbookmarksUrlHook = true;
  function notify() {
    try {
      if (window.mobileApp && window.mobileApp.postMessage) {
        window.mobileApp.postMessage({ type: "xbookmarks-url", url: location.href });
      }
    } catch (e) {}
  }
  function wrap(fn) {
    return function () {
      var ret = fn.apply(this, arguments);
      notify();
      return ret;
    };
  }
  history.pushState = wrap(history.pushState);
  history.replaceState = wrap(history.replaceState);
  window.addEventListener("popstate", notify);
  notify();
})();
`;

export type FeedUrlHandler = (url: string) => void;
export type FeedSaveHandler = (url: string) => void;

let browserId: string | null = null;
let currentUrl = X_FEED_URL;
let listeners: PluginListenerHandle[] = [];
let opened = false;
let opening: Promise<void> | null = null;
/** When true, Shell must not call showXFeed (folder picker is open). */
let uiSuspended = false;
/** Host route wants the feed visible (Feed tab active). */
let feedRouteActive = false;
let onUrlChangeCb: FeedUrlHandler | null = null;
let onSaveRequestCb: FeedSaveHandler | null = null;

export function isNativeApp(): boolean {
  return Capacitor.isNativePlatform();
}

export function getCurrentFeedUrl(): string {
  return currentUrl;
}

export function tweetIdFromFeedUrl(url: string): string | null {
  return extractTweetIdFromUrl(url);
}

export function setFeedUiSuspended(suspended: boolean): void {
  uiSuspended = suspended;
}

export function isFeedUiSuspended(): boolean {
  return uiSuspended;
}

export function setFeedRouteActive(active: boolean): void {
  feedRouteActive = active;
}

function feedHeight(): number {
  return Math.max(240, Math.floor(window.innerHeight - FEED_BOTTOM_RESERVE_PX));
}

function applyUrl(url: string): void {
  if (!url || url === currentUrl) return;
  currentUrl = url;
  onUrlChangeCb?.(url);
}

function parseWebviewMessage(event: unknown): {
  type?: string;
  url?: string;
} | null {
  if (!event || typeof event !== "object") return null;
  const root = event as Record<string, unknown>;
  const detail =
    root.detail && typeof root.detail === "object"
      ? (root.detail as Record<string, unknown>)
      : root;
  return {
    type: typeof detail.type === "string" ? detail.type : undefined,
    url: typeof detail.url === "string" ? detail.url : undefined,
  };
}

async function clearListeners(): Promise<void> {
  await Promise.all(listeners.map((l) => l.remove()));
  listeners = [];
}

async function attachListeners(): Promise<void> {
  await clearListeners();
  listeners.push(
    await InAppBrowser.addListener("urlChangeEvent", (event) => {
      applyUrl(event.url);
    }),
  );
  listeners.push(
    await InAppBrowser.addListener("messageFromWebview", (event) => {
      const payload = parseWebviewMessage(event);
      if (payload?.type === "xbookmarks-url" && payload.url) {
        applyUrl(payload.url);
      }
    }),
  );
  listeners.push(
    await InAppBrowser.addListener("browserPageLoaded", () => {
      void injectUrlHook();
    }),
  );
  listeners.push(
    await InAppBrowser.addListener("closeEvent", () => {
      // Should not happen with blank toolbar; recover cleanly if it does.
      opened = false;
      browserId = null;
    }),
  );
  listeners.push(
    await InAppBrowser.addListener("hideEvent", () => {
      // closeAction HIDE or programmatic hide — keep browserId so we can show again
    }),
  );
}

async function injectUrlHook(): Promise<void> {
  if (!browserId) return;
  try {
    await InAppBrowser.executeScript({
      id: browserId,
      code: URL_HOOK_SCRIPT,
    });
  } catch {
    // page may block injection briefly
  }
}

async function resizeFeed(): Promise<void> {
  if (!browserId || uiSuspended) return;
  try {
    await InAppBrowser.updateDimensions({
      id: browserId,
      height: feedHeight(),
      width: window.innerWidth,
      x: 0,
      y: 0,
    });
  } catch {
    // ignore
  }
}

/**
 * Ask the WebView for location.href (more reliable than last cached SPA URL).
 */
export async function readLiveFeedUrl(): Promise<string> {
  if (!isNativeApp() || !browserId) return currentUrl;

  return new Promise((resolve) => {
    let done = false;
    const finish = (url: string) => {
      if (done) return;
      done = true;
      void handle?.remove();
      applyUrl(url);
      resolve(url);
    };

    let handle: PluginListenerHandle | null = null;
    const timer = window.setTimeout(() => finish(currentUrl), 700);

    void (async () => {
      handle = await InAppBrowser.addListener("messageFromWebview", (event) => {
        const payload = parseWebviewMessage(event);
        if (payload?.type === "xbookmarks-url" && payload.url) {
          window.clearTimeout(timer);
          finish(payload.url);
        }
      });
      try {
        await InAppBrowser.executeScript({
          id: browserId!,
          code: `
            try {
              window.mobileApp.postMessage({ type: "xbookmarks-url", url: location.href });
            } catch (e) {}
          `,
        });
      } catch {
        window.clearTimeout(timer);
        finish(currentUrl);
      }
    })();
  });
}

export async function openXFeed(options: {
  onUrlChange: FeedUrlHandler;
  onSaveRequest: FeedSaveHandler;
}): Promise<void> {
  if (!isNativeApp()) return;

  onUrlChangeCb = options.onUrlChange;
  onSaveRequestCb = options.onSaveRequest;
  options.onUrlChange(currentUrl);

  if (opening) {
    await opening;
    await attachListeners();
    if (opened && browserId && feedRouteActive && !uiSuspended) {
      await InAppBrowser.show({ id: browserId });
      await resizeFeed();
    }
    return;
  }

  opening = (async () => {
    await attachListeners();

    if (opened && browserId) {
      if (feedRouteActive && !uiSuspended) {
        await InAppBrowser.show({ id: browserId });
        await resizeFeed();
        await injectUrlHook();
      }
      return;
    }

    // Blank toolbar = no close (X) button. Bookmark lives in our app strip.
    const { id } = await InAppBrowser.openWebView({
      url: currentUrl && currentUrl !== "about:blank" ? currentUrl : X_FEED_URL,
      height: feedHeight(),
      width: window.innerWidth,
      x: 0,
      y: 0,
      toolbarType: ToolBarType.BLANK,
      toolbarColor: "#0a0a0a",
      toolbarTextColor: "#d4a017",
      visibleTitle: false,
      showArrow: false,
      closeAction: CloseAction.HIDE,
      backgroundColor: BackgroundColor.BLACK,
      customUserAgent: CHROME_MOBILE_UA,
      persistWebViewData: true,
    });

    browserId = id;
    opened = true;

    if (!feedRouteActive || uiSuspended) {
      await InAppBrowser.hide({ id: browserId });
    } else {
      await resizeFeed();
      await injectUrlHook();
    }
  })().finally(() => {
    opening = null;
  });

  await opening;
}

export async function hideXFeed(): Promise<void> {
  if (!isNativeApp() || !browserId) return;
  try {
    await InAppBrowser.hide({ id: browserId });
  } catch {
    // already closed
  }
}

export async function showXFeed(): Promise<void> {
  if (!isNativeApp() || uiSuspended) return;

  // If the WebView was destroyed (old close X), recreate on next Feed visit.
  if (!browserId || !opened) {
    if (onUrlChangeCb && onSaveRequestCb) {
      await openXFeed({
        onUrlChange: onUrlChangeCb,
        onSaveRequest: onSaveRequestCb,
      });
    }
    return;
  }

  try {
    await InAppBrowser.show({ id: browserId });
    await resizeFeed();
  } catch {
    // WebView gone — force recreate next open
    opened = false;
    browserId = null;
    if (onUrlChangeCb && onSaveRequestCb) {
      await openXFeed({
        onUrlChange: onUrlChangeCb,
        onSaveRequest: onSaveRequestCb,
      });
    }
  }
}

/**
 * Navigate the in-app X Feed WebView to a permalink (bookmark Open).
 * Sets currentUrl so a not-yet-created WebView opens on this page.
 */
export async function openUrlInFeed(url: string): Promise<void> {
  if (!url) return;
  currentUrl = url;
  onUrlChangeCb?.(url);
  feedRouteActive = true;

  if (!isNativeApp()) {
    window.open(url, "_blank", "noopener,noreferrer");
    return;
  }

  if (opened && browserId) {
    try {
      await InAppBrowser.setUrl({ id: browserId, url });
      if (!uiSuspended) {
        await InAppBrowser.show({ id: browserId });
        await resizeFeed();
      }
      return;
    } catch {
      opened = false;
      browserId = null;
    }
  }

  // WebView not ready yet — FeedPage openXFeed() will load currentUrl.
  if (onUrlChangeCb && onSaveRequestCb) {
    await openXFeed({
      onUrlChange: onUrlChangeCb,
      onSaveRequest: onSaveRequestCb,
    });
  }
}

export async function closeXFeed(): Promise<void> {
  if (!isNativeApp()) return;
  try {
    await InAppBrowser.close();
  } catch {
    // ignore
  }
  await clearListeners();
  browserId = null;
  opened = false;
  currentUrl = X_FEED_URL;
  uiSuspended = false;
}

export function bindFeedResizeListener(): () => void {
  if (!isNativeApp()) return () => {};
  const onResize = () => {
    void resizeFeed();
  };
  window.addEventListener("resize", onResize);
  return () => window.removeEventListener("resize", onResize);
}
