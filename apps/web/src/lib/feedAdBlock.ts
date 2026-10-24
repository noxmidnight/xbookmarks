import type { NativeProxyRule } from "@capgo/capacitor-inappbrowser";

const X_LOGIN =
  "https://x.com/i/flow/login?redirect_after_login=%2Fhome";

/**
 * Block ad / tracker hosts so their JS never loads into the Feed WebView.
 * Also block Google account hosts (Sign-In is broken in WebViews anyway).
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
  // Google account / Sign-In surfaces (main-frame navigations)
  "accounts.google.com",
  "*.accounts.google.com",
  "myaccount.google.com",
  "*.myaccount.google.com",
  "oauthaccountmanager.googleapis.com",
  "accounts.youtube.com",
  "www.google.com",
  "google.com",
];

/** Native cancel — request never completes; script body never executes. */
export const AD_OUTBOUND_CANCEL_RULES: NativeProxyRule[] = [
  {
    id: "google-accounts",
    urlRegex: "^https?://([^/]*\\.)?accounts\\.google\\.com/.*",
    action: "cancel",
  },
  {
    id: "google-myaccount",
    urlRegex: "^https?://([^/]*\\.)?myaccount\\.google\\.com/.*",
    action: "cancel",
  },
  {
    id: "google-com-accounts",
    urlRegex: "^https?://(www\\.)?google\\.com/(accounts|signin|oauth|AccountChooser).*",
    action: "cancel",
  },
  {
    id: "google-gsi",
    urlRegex: "^https?://([^/]*\\.)?google\\.[a-z.]+/(gsi|o/oauth2|signin|accounts)/.*",
    action: "cancel",
  },
  {
    id: "google-oauth-mgr",
    urlRegex: "^https?://oauthaccountmanager\\.googleapis\\.com/.*",
    action: "cancel",
  },
  {
    id: "youtube-accounts",
    urlRegex: "^https?://accounts\\.youtube\\.com/.*",
    action: "cancel",
  },
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
 * documentStart script:
 * 1) If this is a Google account page → immediate redirect to X username login
 * 2) On X → hide Google buttons + block ads
 */
export const AD_KILL_PRESHOW_SCRIPT = `
(function () {
  var X_LOGIN = ${JSON.stringify(X_LOGIN)};
  var host = ((location && location.hostname) || "").toLowerCase();
  var href = (location && location.href) || "";

  function isGoogleAccountSurface() {
    if (!host) return false;
    if (
      host === "accounts.google.com" ||
      host.slice(-20) === ".accounts.google.com" ||
      host === "myaccount.google.com" ||
      host.slice(-21) === ".myaccount.google.com" ||
      host === "accounts.youtube.com" ||
      host === "oauthaccountmanager.googleapis.com"
    ) {
      return true;
    }
    if (host === "google.com" || host === "www.google.com") {
      return /\\/(accounts|signin|oauth|AccountChooser|ServiceLogin|v3\\/signin|gsi)\\b/i.test(href);
    }
    if (/google\\./i.test(host) && /\\/(gsi|o\\/oauth2|signin|accounts|AccountChooser)\\b/i.test(href)) {
      return true;
    }
    return false;
  }

  // Escape Google immediately — do not paint the account / clear-cookies page.
  if (isGoogleAccountSurface()) {
    try {
      location.replace(X_LOGIN);
    } catch (e) {
      location.href = X_LOGIN;
    }
    return;
  }

  // From here: X / Twitter pages only.
  if (!/(^|\\.)(x|twitter)\\.com$/i.test(host)) return;

  if (!window.__xbookmarksGoogleBtnBlock) {
    window.__xbookmarksGoogleBtnBlock = true;

    var STYLE_G = "xbookmarks-hide-google-btn";
    function hideGoogleButtons() {
      if (!document.getElementById(STYLE_G)) {
        var s = document.createElement("style");
        s.id = STYLE_G;
        s.textContent = [
          '[data-testid="google_sign_in_container"],',
          '[data-testid*="google" i],',
          'div[aria-label*="Google" i],',
          'button[aria-label*="Google" i],',
          'a[href*="accounts.google.com"],',
          'iframe[src*="accounts.google.com"],',
          'iframe[src*="gsi/"] { display: none !important; }'
        ].join("\\n");
        (document.head || document.documentElement).appendChild(s);
      }
      document.querySelectorAll("span,div,button,a").forEach(function (el) {
        var t = (el.textContent || "").trim();
        if (
          t === "Sign in with Google" ||
          t === "Continue with Google" ||
          t === "Sign up with Google"
        ) {
          var node = el.closest("button,a,div[role=button]") || el;
          node.style.setProperty("display", "none", "important");
          node.style.setProperty("pointer-events", "none", "important");
        }
      });
    }

    document.addEventListener(
      "click",
      function (ev) {
        var t = ev.target;
        if (!t || !t.closest) return;
        var hit = t.closest("button,a,div[role=button],div[data-testid]");
        if (!hit) return;
        var label = ((hit.getAttribute("aria-label") || "") + " " + (hit.textContent || "")).toLowerCase();
        var href = (hit.getAttribute("href") || "").toLowerCase();
        if (
          label.indexOf("google") !== -1 ||
          href.indexOf("accounts.google") !== -1 ||
          href.indexOf("gsi/") !== -1
        ) {
          ev.preventDefault();
          ev.stopPropagation();
          try {
            window.mobileApp.postMessage({ type: "xbookmarks-block-google", url: href || "google-btn" });
          } catch (e) {}
          return false;
        }
      },
      true,
    );

    hideGoogleButtons();
    new MutationObserver(hideGoogleButtons).observe(document.documentElement || document, {
      childList: true,
      subtree: true,
    });
  }

  if (window.__xbookmarksAdKill) return;
  window.__xbookmarksAdKill = true;

  var HOST_RE = /(^|\\.)((ads-twitter\\.com)|(static\\.ads-twitter\\.com)|(ads\\.twitter\\.com)|(ads-api\\.twitter\\.com)|(ads-bidder-api\\.twitter\\.com)|(analytics\\.twitter\\.com)|(advertise\\.twitter\\.com)|(advertising\\.twitter\\.com)|(syndication\\.twitter\\.com)|(doubleclick\\.net)|(googlesyndication\\.com)|(googleadservices\\.com)|(googletagservices\\.com)|(moatads\\.com)|(adsrvr\\.org)|(scorecardresearch\\.com)|(amazon-adsystem\\.com)|(adservice\\.google\\.com)|(accounts\\.google\\.com)|(myaccount\\.google\\.com))$/i;
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
