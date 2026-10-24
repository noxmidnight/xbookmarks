import { Capacitor, type PluginListenerHandle } from "@capacitor/core";
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
import { measureSafeAreaBottom, TAB_BAR_PX } from "./safeArea";
import { openXGoogleLoginInBrave } from "./xGoogleLogin";

export const X_FEED_URL = "https://x.com/home";
/** Username/password login — Google Sign-In is blocked inside Android WebViews. */
export const X_LOGIN_URL =
  "https://x.com/i/flow/login?redirect_after_login=%2Fhome";

/** Chrome Android UA — X often rejects the default WebView user-agent. */
const CHROME_MOBILE_UA =
  "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36";

export type FeedAuthHintHandler = (message: string) => void;
export type FeedUrlHandler = (url: string) => void;
export type FeedSaveHandler = (url: string) => void;

let onAuthHintCb: FeedAuthHintHandler | null = null;
let googleAuthHandled = false;

/**
 * SPA URL tracking + block Google window.open + hide Promoted cards.
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

    var origOpen = window.open;
    window.open = function (url) {
      var s = url == null ? "" : String(url);
      if (/accounts\\.google|myaccount\\.google|google\\.[^"'\\s]+\\/(gsi|o\\/oauth2|signin|accounts)/i.test(s)) {
        try {
          window.mobileApp.postMessage({ type: "xbookmarks-block-google", url: s });
        } catch (e) {}
        return null;
      }
      return origOpen.apply(this, arguments);
    };
  }

  if (window.__xbookmarksAdHide) return;
  window.__xbookmarksAdHide = true;

  var STYLE_ID = "xbookmarks-hide-ads";
  function injectCss() {
    if (document.getElementById(STYLE_ID)) return;
    var s = document.createElement("style");
    s.id = STYLE_ID;
    s.textContent = [
      'div[data-testid="placementTracking"] { display: none !important; }',
      '[data-testid="cellInnerDiv"]:has([data-testid="placementTracking"]) { display: none !important; }',
      'aside[aria-label*="Timeline: Trending"], div[data-testid="sidebarColumn"] [data-testid="placementTracking"] { display: none !important; }'
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
        if (t === "Promoted" || t === "Ad" || t.indexOf("Promoted by") === 0) {
          var cell2 = article.closest('[data-testid="cellInnerDiv"]') || article;
          cell2.style.setProperty("display", "none", "important");
          return;
        }
      }
    });
  }

  injectCss();
  hidePromoted();
  var mo = new MutationObserver(function () {
    hidePromoted();
  });
  mo.observe(document.documentElement, { childList: true, subtree: true });
})();
`;

let browserId: string | null = null;
/** GSI / window.open popups — must be closed on tab switch or they cover the whole app. */
const popupIds = new Set<string>();
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

/** Space reserved under the X WebView: tab bar + Android/iOS home indicator. */
export function feedBottomReservePx(): number {
  return TAB_BAR_PX + measureSafeAreaBottom();
}

function feedHeight(): number {
  return Math.max(240, Math.floor(window.innerHeight - feedBottomReservePx()));
}

export function isGoogleAuthUrl(url: string): boolean {
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase();
    const path = `${u.pathname}${u.search}`;
    if (
      host === "accounts.google.com" ||
      host.endsWith(".accounts.google.com") ||
      host === "myaccount.google.com" ||
      host.endsWith(".myaccount.google.com") ||
      host === "accounts.youtube.com" ||
      host === "oauthaccountmanager.googleapis.com"
    ) {
      return true;
    }
    if (host === "google.com" || host === "www.google.com") {
      return /\/(accounts|signin|oauth|AccountChooser|ServiceLogin|v3\/signin|gsi)\b/i.test(
        path,
      );
    }
    if (
      host.includes("google.") &&
      /\/(gsi|o\/oauth2|signin|accounts|AccountChooser)\b/i.test(path)
    ) {
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

async function closeAllPopups(): Promise<void> {
  const ids = [...popupIds];
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

async function bounceAwayFromGoogle(sourceId?: string): Promise<void> {
  // Always dismiss Google popups / surfaces — never leave them covering the app.
  if (sourceId && sourceId !== browserId) {
    popupIds.delete(sourceId);
    try {
      await InAppBrowser.close({ id: sourceId });
    } catch {
      // ignore
    }
  }
  await closeAllPopups();

  // Hide Feed WebView while Brave handles Google (WebView cannot complete Google OAuth).
  if (browserId) {
    try {
      await InAppBrowser.hide({ id: browserId });
    } catch {
      // ignore
    }
  }

  if (!googleAuthHandled) {
    googleAuthHandled = true;
    onAuthHintCb?.(
      "GOOGLE_BRAVE_FLOW",
    );
  }

  // Real Google Sign-In for X-only-via-Google accounts.
  await openXGoogleLoginInBrave();

  // Keep WebView on X login (username/password after they set one in Brave).
  if (!browserId) return;
  try {
    await InAppBrowser.setUrl({ id: browserId, url: X_LOGIN_URL });
    currentUrl = X_LOGIN_URL;
    onUrlChangeCb?.(X_LOGIN_URL);
  } catch {
    try {
      await InAppBrowser.executeScript({
        id: browserId,
        code: `location.replace(${JSON.stringify(X_LOGIN_URL)});`,
      });
    } catch {
      // ignore
    }
  }
}

function applyUrl(url: string, sourceId?: string): void {
  if (!url) return;
  if (url !== currentUrl && (!sourceId || sourceId === browserId)) {
    currentUrl = url;
    onUrlChangeCb?.(url);
  }

  if (isGoogleAuthUrl(url)) {
    void bounceAwayFromGoogle(sourceId);
    return;
  }

  if (url.includes("x.com") || url.includes("twitter.com")) {
    googleAuthHandled = false;
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
      if (payload?.type === "xbookmarks-block-google") {
        void bounceAwayFromGoogle();
      }
    }),
  );
  listeners.push(
    await InAppBrowser.addListener("browserPageLoaded", (event) => {
      const url =
        event && typeof event === "object" && "url" in event
          ? String((event as { url?: string }).url || "")
          : currentUrl;
      if (isGoogleAuthUrl(url) || isGoogleAuthUrl(currentUrl)) {
        void bounceAwayFromGoogle(browserId ?? undefined);
        return;
      }
      void injectFeedScripts();
    }),
  );
  listeners.push(
    await InAppBrowser.addListener("popupWindowOpened", (event) => {
      popupIds.add(event.id);
      const url = event.url || "";
      if (isGoogleAuthUrl(url) || !url) {
        // Google GSI popup (or unknown) — never leave it covering the app.
        void bounceAwayFromGoogle(event.id);
        return;
      }
      // Keep non-Google popups from covering other tabs: hide unless Feed is active.
      if (!feedRouteActive || uiSuspended) {
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
      if (!event.id || event.id === browserId) {
        opened = false;
        browserId = null;
      }
    }),
  );
  listeners.push(
    await InAppBrowser.addListener("hideEvent", () => {
      // keep browserId
    }),
  );
}

async function injectFeedScripts(): Promise<void> {
  if (!browserId) return;
  try {
    await InAppBrowser.executeScript({
      id: browserId,
      code: FEED_PAGE_SCRIPT,
    });
  } catch {
    // page may block injection briefly
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
      // No Google Pay / GSI popup support — Google Sign-In cannot work in WebView.
      enableGooglePaySupport: false,
      hiddenPopupWindow: true,
      blockedHosts: AD_BLOCKED_HOSTS,
      outboundProxyRules: AD_OUTBOUND_CANCEL_RULES,
      isPresentAfterPageLoad: true,
      preShowScript: AD_KILL_PRESHOW_SCRIPT,
      preShowScriptInjectionTime: "documentStart",
    });

    browserId = id;
    opened = true;

    if (!feedRouteActive || uiSuspended) {
      await InAppBrowser.hide({ id: browserId });
    } else {
      await resizeFeed();
      await injectFeedScripts();
    }
  })().finally(() => {
    opening = null;
  });

  await opening;
}

export async function hideXFeed(): Promise<void> {
  if (!isNativeApp()) return;
  // Popups (e.g. Google auth) sit above the app — always dismiss them on tab switch.
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

  // Never leave a stray popup on screen when returning to Feed.
  await closeAllPopups();

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
    // If we were stuck on Google, force username login.
    if (isGoogleAuthUrl(currentUrl)) {
      await InAppBrowser.setUrl({ id: browserId, url: X_LOGIN_URL });
      currentUrl = X_LOGIN_URL;
    }
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

/**
 * Navigate the in-app X Feed WebView to a permalink (bookmark Open).
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
  googleAuthHandled = false;
}

/**
 * Clear X/Google cookies in the Feed WebView and open the username login page.
 */
export async function resetFeedLogin(): Promise<void> {
  if (!isNativeApp()) return;
  googleAuthHandled = false;
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
    void resizeFeed();
  };
  window.addEventListener("resize", onResize);
  return () => window.removeEventListener("resize", onResize);
}

/** @deprecated Use feedBottomReservePx() — kept for any leftover imports. */
export const FEED_BOTTOM_RESERVE_PX = TAB_BAR_PX;
