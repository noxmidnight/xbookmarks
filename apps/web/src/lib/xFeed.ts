import {
  Capacitor,
  registerPlugin,
  type PluginListenerHandle,
} from "@capacitor/core";
import {
  BackgroundColor,
  CloseAction,
  InAppBrowser,
  ToolBarType,
} from "@capgo/capacitor-inappbrowser";
import { extractTweetIdFromUrl } from "@xbookmarks/shared";
import {
  AD_BLOCKED_HOSTS,
  AD_KILL_PRESHOW_SCRIPT,
  AD_OUTBOUND_CANCEL_RULES,
} from "./feedAdBlock";
import {
  measureSafeAreaBottom,
  measureSafeAreaTop,
  TAB_BAR_PX,
} from "./safeArea";

export const X_FEED_URL = "https://x.com/home";
export const X_LOGIN_URL =
  "https://x.com/i/flow/login?redirect_after_login=%2Fhome";

/** Chrome Android UA — X often rejects the default WebView user-agent. */
const CHROME_MOBILE_UA =
  "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36";

export type FeedAuthHintHandler = (message: string) => void;
export type FeedUrlHandler = (url: string) => void;
export type FeedSaveHandler = (url: string) => void;

let onAuthHintCb: FeedAuthHintHandler | null = null;

/**
 * SPA URL tracking + hide Promoted cards.
 * Do NOT intercept Google window.open — that broke Sign-In with Google.
 */
const FEED_PAGE_SCRIPT = `
(function () {
  if (!window.__xbookmarksUrlHook) {
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
  }

  if (window.__xbookmarksAdHideCss) return;
  window.__xbookmarksAdHideCss = true;

  var STYLE_ID = "xbookmarks-hide-ads";
  function injectCss() {
    if (document.getElementById(STYLE_ID)) return;
    var s = document.createElement("style");
    s.id = STYLE_ID;
    s.textContent = [
      'div[data-testid="placementTracking"] { display: none !important; }',
      '[data-testid="cellInnerDiv"]:has([data-testid="placementTracking"]) { display: none !important; }'
    ].join("\\n");
    (document.head || document.documentElement).appendChild(s);
  }

  function hidePromoted() {
    injectCss();
    document.querySelectorAll("article").forEach(function (article) {
      if (article.querySelector('[data-testid="placementTracking"]')) {
        var cell = article.closest('[data-testid="cellInnerDiv"]') || article;
        cell.style.setProperty("display", "none", "important");
        return;
      }
      var spans = article.querySelectorAll("span");
      for (var i = 0; i < spans.length; i++) {
        var t = (spans[i].textContent || "").trim();
        if (t === "Promoted" || t.indexOf("Promoted by") === 0) {
          var cell2 = article.closest('[data-testid="cellInnerDiv"]') || article;
          cell2.style.setProperty("display", "none", "important");
          return;
        }
      }
    });
  }

  injectCss();
  hidePromoted();
  new MutationObserver(hidePromoted).observe(document.documentElement, {
    childList: true,
    subtree: true,
  });
})();
`;

let browserId: string | null = null;
/** Popups (incl. Google GSI) — close on tab switch so they don't cover Folders/etc. */
const popupIds = new Set<string>();
let currentUrl = X_FEED_URL;
let listeners: PluginListenerHandle[] = [];
let opened = false;
let opening: Promise<void> | null = null;
let uiSuspended = false;
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

export function feedBottomReservePx(): number {
  return TAB_BAR_PX + measureSafeAreaBottom();
}

type SystemInsets = { top: number; bottom: number };
const SystemInsetsNative = registerPlugin<{
  get(): Promise<SystemInsets>;
}>("SystemInsets");
let statusBarPx = 0;

async function refreshSystemInsets(): Promise<void> {
  try {
    statusBarPx = (await SystemInsetsNative.get()).top;
  } catch {
    statusBarPx = measureSafeAreaTop();
  }
}

/**
 * The Feed dialog is laid out from the top of the screen (it pads the status
 * bar itself), while window.innerHeight excludes the status bar — so the
 * status bar height must be added back for the WebView to reach the tab bar.
 */
function feedHeight(): number {
  return Math.max(
    240,
    Math.floor(statusBarPx + window.innerHeight - feedBottomReservePx()),
  );
}

export function isGoogleAuthUrl(url: string): boolean {
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase();
    return (
      host === "accounts.google.com" ||
      host.endsWith(".accounts.google.com") ||
      host.includes("google.") && /\/(gsi|o\/oauth2|signin)\b/i.test(u.pathname)
    );
  } catch {
    return false;
  }
}

async function closeAllPopups(): Promise<void> {
  const ids = [...popupIds].filter((id) => id !== browserId);
  popupIds.clear();
  await Promise.all(
    ids.map(async (id) => {
      try {
        await InAppBrowser.close({ id });
      } catch {
        // already gone
      }
    }),
  );
}

function applyUrl(url: string, sourceId?: string): void {
  if (!url) return;
  if (url !== currentUrl && (!sourceId || sourceId === browserId)) {
    currentUrl = url;
    onUrlChangeCb?.(url);
  }
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
      applyUrl(event.url, event.id);
    }),
  );
  listeners.push(
    await InAppBrowser.addListener("messageFromWebview", (event) => {
      const payload = parseWebviewMessage(event);
      if (payload?.type === "xbookmarks-url" && payload.url) {
        applyUrl(payload.url, browserId ?? undefined);
      }
    }),
  );
  listeners.push(
    await InAppBrowser.addListener("browserPageLoaded", () => {
      void injectFeedScripts();
    }),
  );
  listeners.push(
    await InAppBrowser.addListener("popupWindowOpened", (event) => {
      popupIds.add(event.id);
      // Allow Google / other popups while on Feed; show them (GSI needs a visible window).
      if (feedRouteActive && !uiSuspended) {
        void InAppBrowser.show({ id: event.id }).catch(() => undefined);
      } else {
        void InAppBrowser.close({ id: event.id }).then(() => {
          popupIds.delete(event.id);
        });
      }
    }),
  );
  listeners.push(
    await InAppBrowser.addListener("closeEvent", (event) => {
      if (event.id && popupIds.has(event.id)) {
        popupIds.delete(event.id);
        return;
      }
      // Never drop the main Feed WebView id on a bare close without id —
      // that used to force a cold reopen and looked like a lost session.
      if (event.id && event.id === browserId) {
        opened = false;
        browserId = null;
        // Reopening on the login flow looks like a lost session even when
        // the auth cookies are still there.
        if (/\/i\/flow\/login/.test(currentUrl)) currentUrl = X_FEED_URL;
      }
    }),
  );
  listeners.push(
    await InAppBrowser.addListener("hideEvent", () => {
      // Hide keeps cookies + SPA state; browserId stays.
    }),
  );
}

async function injectFeedScripts(): Promise<void> {
  if (!browserId) return;
  // Only inject into X pages — never into Google auth documents.
  if (isGoogleAuthUrl(currentUrl)) return;
  try {
    await InAppBrowser.executeScript({
      id: browserId,
      code: FEED_PAGE_SCRIPT,
    });
  } catch {
    // ignore
  }
}

async function resizeFeed(): Promise<void> {
  if (!browserId || uiSuspended || !feedRouteActive) return;
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

export async function readLiveFeedUrl(): Promise<string> {
  if (!isNativeApp() || !browserId) return currentUrl;

  return new Promise((resolve) => {
    let done = false;
    const finish = (url: string) => {
      if (done) return;
      done = true;
      void handle?.remove();
      applyUrl(url, browserId ?? undefined);
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
  onAuthHint?: FeedAuthHintHandler;
}): Promise<void> {
  if (!isNativeApp()) return;

  onUrlChangeCb = options.onUrlChange;
  onSaveRequestCb = options.onSaveRequest;
  onAuthHintCb = options.onAuthHint ?? null;
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
        await injectFeedScripts();
      }
      return;
    }

    await refreshSystemInsets();
    const startHidden = !feedRouteActive || uiSuspended;
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
      // Keep Feed below status bar / above gesture nav.
      enabledSafeTopMargin: true,
      useTopInset: true,
      enabledSafeBottomMargin: false,
      // Android back walks X history; at the root it is ignored instead of
      // dismissing (which destroyed the WebView and the loaded session).
      activeNativeNavigationForWebview: true,
      disableGoBackOnNativeApplication: true,
      // Needed for X "Sign in with Google" GSI popup (postMessage back to x.com).
      enableGooglePaySupport: true,
      hiddenPopupWindow: false,
      blockedHosts: AD_BLOCKED_HOSTS,
      outboundProxyRules: AD_OUTBOUND_CANCEL_RULES,
      isPresentAfterPageLoad: true,
      // Prefetch off-Feed so first open + return visits keep the same WebView/session.
      hidden: startHidden,
      // CSS-only ad hide on x.com — never runs on Google documents.
      preShowScript: AD_KILL_PRESHOW_SCRIPT,
      preShowScriptInjectionTime: "documentStart",
    });

    browserId = id;
    opened = true;

    if (startHidden) {
      try {
        await InAppBrowser.hide({ id: browserId });
      } catch {
        // already hidden
      }
    } else {
      await resizeFeed();
      await injectFeedScripts();
    }
  })().finally(() => {
    opening = null;
  });

  await opening;
}

/**
 * Open the Feed WebView in the background (cookies + X SPA stay warm).
 * Call once after sign-in so tab switches don't recreate the WebView.
 */
export async function warmXFeed(): Promise<void> {
  if (!isNativeApp() || opened || opening) return;
  // FeedPage replaces these when it mounts; placeholders must not reference
  // the module callbacks or openXFeed would make them call themselves.
  await openXFeed({
    onUrlChange: onUrlChangeCb ?? (() => {}),
    onSaveRequest: onSaveRequestCb ?? (() => {}),
    onAuthHint: onAuthHintCb ?? undefined,
  });
}

export async function hideXFeed(): Promise<void> {
  if (!isNativeApp()) return;
  // Don't leave Google / other popups covering Folders / All / Settings.
  await closeAllPopups();
  if (!browserId) return;
  try {
    await InAppBrowser.hide({ id: browserId });
  } catch {
    // already closed
  }
}

export async function showXFeed(): Promise<void> {
  if (!isNativeApp() || uiSuspended) return;

  if (!browserId || !opened) {
    if (onUrlChangeCb && onSaveRequestCb) {
      await openXFeed({
        onUrlChange: onUrlChangeCb,
        onSaveRequest: onSaveRequestCb,
        onAuthHint: onAuthHintCb ?? undefined,
      });
    }
    return;
  }

  try {
    await InAppBrowser.show({ id: browserId });
    await resizeFeed();
  } catch {
    opened = false;
    browserId = null;
    if (onUrlChangeCb && onSaveRequestCb) {
      await openXFeed({
        onUrlChange: onUrlChangeCb,
        onSaveRequest: onSaveRequestCb,
        onAuthHint: onAuthHintCb ?? undefined,
      });
    }
  }
}

export async function openUrlInFeed(url: string): Promise<void> {
  if (!url) return;
  currentUrl = url;
  onUrlChangeCb?.(url);
  feedRouteActive = true;

  if (!isNativeApp()) {
    window.open(url, "_blank", "noopener,noreferrer");
    return;
  }

  await closeAllPopups();

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

  if (onUrlChangeCb && onSaveRequestCb) {
    await openXFeed({
      onUrlChange: onUrlChangeCb,
      onSaveRequest: onSaveRequestCb,
      onAuthHint: onAuthHintCb ?? undefined,
    });
  }
}

export async function closeXFeed(): Promise<void> {
  if (!isNativeApp()) return;
  await closeAllPopups();
  try {
    if (browserId) await InAppBrowser.close({ id: browserId });
    else await InAppBrowser.close();
  } catch {
    // ignore
  }
  await clearListeners();
  browserId = null;
  opened = false;
  currentUrl = X_FEED_URL;
  uiSuspended = false;
}

export async function resetFeedLogin(): Promise<void> {
  if (!isNativeApp()) return;
  await closeAllPopups();
  const urls = [
    "https://x.com",
    "https://twitter.com",
    "https://mobile.twitter.com",
    "https://api.x.com",
    "https://accounts.google.com",
    "https://accounts.youtube.com",
  ];
  for (const url of urls) {
    try {
      await InAppBrowser.clearCookies({ url });
    } catch {
      // ignore
    }
  }
  try {
    await InAppBrowser.clearCache();
  } catch {
    // ignore
  }

  currentUrl = X_LOGIN_URL;
  feedRouteActive = true;
  if (opened && browserId) {
    try {
      await InAppBrowser.setUrl({ id: browserId, url: X_LOGIN_URL });
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
  if (onUrlChangeCb && onSaveRequestCb) {
    await openXFeed({
      onUrlChange: onUrlChangeCb,
      onSaveRequest: onSaveRequestCb,
      onAuthHint: onAuthHintCb ?? undefined,
    });
  }
}

export function bindFeedResizeListener(): () => void {
  if (!isNativeApp()) return () => {};
  const onResize = () => {
    void refreshSystemInsets().then(resizeFeed);
  };
  window.addEventListener("resize", onResize);
  return () => window.removeEventListener("resize", onResize);
}

export const FEED_BOTTOM_RESERVE_PX = TAB_BAR_PX;
