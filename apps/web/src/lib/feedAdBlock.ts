import type { NativeProxyRule } from "@capgo/capacitor-inappbrowser";

/**
 * Block ad / tracker hosts so their JS never loads into the Feed WebView.
 * (First-party “Promoted” timeline cards are still DOM-hidden — those are
 * served inside x.com’s own app JS, not separate ad scripts.)
 */
export const AD_BLOCKED_HOSTS: string[] = [
  "ads-twitter.com",
  "*.ads-twitter.com",
  "static.ads-twitter.com",
  "ads.twitter.com",
  "ads-api.twitter.com",
  "ads-bidder-api.twitter.com",
  "analytics.twitter.com",
  "advertise.twitter.com",
  "advertising.twitter.com",
  "syndication.twitter.com",
  "doubleclick.net",
  "*.doubleclick.net",
  "googlesyndication.com",
  "*.googlesyndication.com",
  "googleadservices.com",
  "*.googleadservices.com",
  "googletagservices.com",
  "*.googletagservices.com",
  "pagead2.googlesyndication.com",
  "moatads.com",
  "*.moatads.com",
  "adsrvr.org",
  "*.adsrvr.org",
  "scorecardresearch.com",
  "*.scorecardresearch.com",
  "amazon-adsystem.com",
  "*.amazon-adsystem.com",
  "adservice.google.com",
  "adservice.google.*",
];

/** Native cancel — request never completes; script body never executes. */
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
    id: "analytics-twitter",
    urlRegex: "^https?://analytics\\.twitter\\.com/.*",
    action: "cancel",
  },
  {
    id: "advertise-twitter",
    urlRegex: "^https?://advertis(e|ing)\\.twitter\\.com/.*",
    action: "cancel",
  },
  {
    id: "syndication-twitter",
    urlRegex: "^https?://syndication\\.twitter\\.com/.*",
    action: "cancel",
  },
  {
    id: "x-adsct",
    urlRegex: "^https?://([^/]*\\.)?(x|twitter)\\.com/i/adsct(\\?|/|$).*",
    action: "cancel",
  },
  {
    id: "x-jot",
    urlRegex: "^https?://([^/]*\\.)?(x|twitter)\\.com/i/jot(/|\\?|$).*",
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
    id: "googleadservices",
    urlRegex: "^https?://([^/]*\\.)?googleadservices\\.com/.*",
    action: "cancel",
  },
  {
    id: "googletagservices",
    urlRegex: "^https?://([^/]*\\.)?googletagservices\\.com/.*",
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
    id: "scorecardresearch",
    urlRegex: "^https?://([^/]*\\.)?scorecardresearch\\.com/.*",
    action: "cancel",
  },
  {
    id: "amazon-ads",
    urlRegex: "^https?://([^/]*\\.)?amazon-adsystem\\.com/.*",
    action: "cancel",
  },
];

/**
 * Runs at documentStart (before page JS) via Capgo preShowScript.
 * Neutrals any ad <script> that slips past native cancel, and aborts
 * fetch/XHR to blocked hosts so their code cannot execute.
 */
export const AD_KILL_PRESHOW_SCRIPT = `
(function () {
  if (window.__xbookmarksAdKill) return;
  window.__xbookmarksAdKill = true;

  var HOST_RE = /(^|\\.)((ads-twitter\\.com)|(static\\.ads-twitter\\.com)|(ads\\.twitter\\.com)|(ads-api\\.twitter\\.com)|(ads-bidder-api\\.twitter\\.com)|(analytics\\.twitter\\.com)|(advertise\\.twitter\\.com)|(advertising\\.twitter\\.com)|(syndication\\.twitter\\.com)|(doubleclick\\.net)|(googlesyndication\\.com)|(googleadservices\\.com)|(googletagservices\\.com)|(moatads\\.com)|(adsrvr\\.org)|(scorecardresearch\\.com)|(amazon-adsystem\\.com)|(adservice\\.google\\.com))$/i;
  var PATH_RE = /\\/i\\/(adsct|jot)(\\/|$|\\?)/i;

  function isBad(url) {
    if (!url || typeof url !== "string") return false;
    if (url.indexOf("blob:") === 0 || url.indexOf("data:") === 0) return false;
    try {
      var u = new URL(url, location.href);
      if (HOST_RE.test(u.hostname)) return true;
      var h = u.hostname;
      if (
        (h === "x.com" || h === "twitter.com" || h.slice(-6) === ".x.com" || h.slice(-12) === ".twitter.com") &&
        PATH_RE.test(u.pathname)
      ) {
        return true;
      }
    } catch (e) {}
    return false;
  }

  function neuterScript(el) {
    if (!el || el.tagName !== "SCRIPT") return;
    var src = el.src || el.getAttribute("src") || "";
    if (src && isBad(src)) {
      el.type = "javascript/blocked";
      el.removeAttribute("src");
      try { el.src = ""; } catch (e) {}
      el.textContent = "";
    }
  }

  try {
    var desc = Object.getOwnPropertyDescriptor(HTMLScriptElement.prototype, "src");
    if (desc && desc.set && desc.configurable) {
      Object.defineProperty(HTMLScriptElement.prototype, "src", {
        configurable: true,
        enumerable: desc.enumerable,
        get: desc.get,
        set: function (v) {
          if (isBad(String(v))) {
            this.type = "javascript/blocked";
            return;
          }
          return desc.set.call(this, v);
        },
      });
    }
  } catch (e) {}

  var ce = Document.prototype.createElement;
  Document.prototype.createElement = function (tagName) {
    var el = ce.apply(this, arguments);
    if (String(tagName).toLowerCase() === "script") {
      try {
        var origSetAttribute = el.setAttribute.bind(el);
        el.setAttribute = function (name, value) {
          if (String(name).toLowerCase() === "src" && isBad(String(value))) {
            el.type = "javascript/blocked";
            return;
          }
          return origSetAttribute(name, value);
        };
      } catch (e) {}
    }
    return el;
  };

  var root = document.documentElement || document;
  new MutationObserver(function (muts) {
    for (var i = 0; i < muts.length; i++) {
      var nodes = muts[i].addedNodes;
      for (var j = 0; j < nodes.length; j++) {
        var n = nodes[j];
        if (n.nodeType !== 1) continue;
        if (n.tagName === "SCRIPT") neuterScript(n);
        if (n.querySelectorAll) {
          var scripts = n.querySelectorAll("script");
          for (var k = 0; k < scripts.length; k++) neuterScript(scripts[k]);
        }
      }
    }
  }).observe(root, { childList: true, subtree: true });

  if (typeof window.fetch === "function") {
    var ofetch = window.fetch.bind(window);
    window.fetch = function (input, init) {
      var url =
        typeof input === "string"
          ? input
          : input && typeof input.url === "string"
            ? input.url
            : "";
      if (url && isBad(url)) {
        return Promise.reject(new TypeError("Blocked by XBookmarks"));
      }
      return ofetch(input, init);
    };
  }

  var xo = XMLHttpRequest.prototype.open;
  var xs = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open = function (method, url) {
    this.__xbBlocked = isBad(String(url));
    return xo.apply(this, arguments);
  };
  XMLHttpRequest.prototype.send = function () {
    if (this.__xbBlocked) {
      try { this.abort(); } catch (e) {}
      return;
    }
    return xs.apply(this, arguments);
  };
})();
`;
