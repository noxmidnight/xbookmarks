import type { NativeProxyRule } from "@capgo/capacitor-inappbrowser";

/**
 * Ad blocking only — never touch Google Sign-In / accounts / GSI.
 * (Blocking those hosts or hooking scripts on Google pages broke X login.)
 */
export const AD_BLOCKED_HOSTS: string[] = [
  "ads-twitter.com",
  "*.ads-twitter.com",
  "static.ads-twitter.com",
  "ads.twitter.com",
  "ads-api.twitter.com",
  "ads-bidder-api.twitter.com",
  "advertise.twitter.com",
  "advertising.twitter.com",
  "doubleclick.net",
  "*.doubleclick.net",
  "googlesyndication.com",
  "*.googlesyndication.com",
  "pagead2.googlesyndication.com",
  "moatads.com",
  "*.moatads.com",
  "adsrvr.org",
  "*.adsrvr.org",
  "amazon-adsystem.com",
  "*.amazon-adsystem.com",
];

/** Cancel ad network requests only — not accounts.google.com / GSI / gstatic. */
export const AD_OUTBOUND_CANCEL_RULES: NativeProxyRule[] = [
  {
    id: "ads-twitter",
    urlRegex: "^https?://([^/]*\\.)?ads-twitter\\.com/.*",
    action: "cancel",
  },
  {
    id: "ads-twitter-static",
    urlRegex: "^https?://static\\.ads-twitter\\.com/.*",
    action: "cancel",
  },
  {
    id: "ads-twitter-com",
    urlRegex: "^https?://ads(-api|-bidder-api)?\\.twitter\\.com/.*",
    action: "cancel",
  },
  {
    id: "advertise-twitter",
    urlRegex: "^https?://advertis(e|ing)\\.twitter\\.com/.*",
    action: "cancel",
  },
  {
    id: "x-adsct",
    urlRegex: "^https?://([^/]*\\.)?(x|twitter)\\.com/i/adsct(\\?|/|$).*",
    action: "cancel",
  },
  {
    id: "doubleclick",
    urlRegex: "^https?://([^/]*\\.)?doubleclick\\.net/.*",
    action: "cancel",
  },
  {
    id: "googlesyndication",
    urlRegex: "^https?://([^/]*\\.)?googlesyndication\\.com/.*",
    action: "cancel",
  },
  {
    id: "moat",
    urlRegex: "^https?://([^/]*\\.)?moatads\\.com/.*",
    action: "cancel",
  },
  {
    id: "adsrvr",
    urlRegex: "^https?://([^/]*\\.)?adsrvr\\.org/.*",
    action: "cancel",
  },
  {
    id: "amazon-ads",
    urlRegex: "^https?://([^/]*\\.)?amazon-adsystem\\.com/.*",
    action: "cancel",
  },
];

/**
 * documentStart: run ONLY on x.com / twitter.com.
 * Never inject hooks on Google pages (that broke Sign-In).
 * CSS-hide promoted tweets only — no fetch/XHR/script monkey-patching.
 */
export const AD_KILL_PRESHOW_SCRIPT = `
(function () {
  var host = ((location && location.hostname) || "").toLowerCase();
  if (!/(^|\\.)(x|twitter)\\.com$/i.test(host)) return;
  if (window.__xbookmarksAdHide) return;
  window.__xbookmarksAdHide = true;

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
  new MutationObserver(hidePromoted).observe(document.documentElement || document, {
    childList: true,
    subtree: true,
  });
})();
`;
