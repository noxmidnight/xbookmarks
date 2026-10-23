/** Native X Bookmarks route — folders UI mounts here. */
export const BOOKMARKS_PATH = "/i/bookmarks";
/** Legacy path from earlier builds. */
export const XBOOKMARKS_PATH = "/i/xbookmarks";

export const XB_GOLD = "#d4a017";
export const XB_GOLD_BRIGHT = "#f5c518";

const NAV_ID = "xbookmarks-nav-item";
const HOOK_META_ID = "xbookmarks-nav-hook";

/** Bookmark-style glyph matching X nav icon size (~26px). */
function bookmarkIconSvg(filled = false): string {
  const fill = "currentColor";
  if (filled) {
    return `<svg viewBox="0 0 24 24" aria-hidden="true" class="xb-nav-icon"><path d="M4 4.5C4 3.12 5.12 2 6.5 2h11C18.88 2 20 3.12 20 4.5v18.44l-8-5.71-8 5.71V4.5z" fill="${fill}"></path></svg>`;
  }
  return `<svg viewBox="0 0 24 24" aria-hidden="true" class="xb-nav-icon"><path d="M4 4.5C4 3.12 5.12 2 6.5 2h11C18.88 2 20 3.12 20 4.5v18.44l-8-5.71-8 5.71V4.5zM6.5 4c-.28 0-.5.22-.5.5v14.94l6-4.29 6 4.29V4.5c0-.28-.22-.5-.5-.5h-11z" fill="${fill}"></path></svg>`;
}

function findHomeAndExplore(): {
  home: HTMLAnchorElement | null;
  explore: HTMLAnchorElement | null;
  container: Element | null;
} {
  const home =
    (document.querySelector('a[href="/home"]') as HTMLAnchorElement | null) ||
    (document.querySelector(
      'a[data-testid="AppTabBar_Home_Link"]',
    ) as HTMLAnchorElement | null);
  const explore =
    (document.querySelector('a[href="/explore"]') as HTMLAnchorElement | null) ||
    (document.querySelector(
      'a[data-testid="AppTabBar_Explore_Link"]',
    ) as HTMLAnchorElement | null);

  const container =
    home?.parentElement?.parentElement ||
    home?.parentElement ||
    explore?.parentElement?.parentElement ||
    explore?.parentElement ||
    document.querySelector('nav[aria-label="Primary"]') ||
    document.querySelector('nav[role="navigation"]');

  return { home, explore, container };
}

function findBookmarksLink(): HTMLAnchorElement | null {
  return (
    (document.querySelector(
      'a[href="/i/bookmarks"]',
    ) as HTMLAnchorElement | null) ||
    (document.querySelector(
      'a[href^="/i/bookmarks"]',
    ) as HTMLAnchorElement | null) ||
    (document.querySelector(
      'a[data-testid="AppTabBar_Bookmarks_Link"]',
    ) as HTMLAnchorElement | null)
  );
}

/** Soften X's selected look on other primary nav when our view is open. */
export function clearNativeNavSelection() {
  const root =
    document.querySelector('nav[aria-label="Primary"]') ||
    document.querySelector('nav[role="navigation"]') ||
    document.body;

  root.querySelectorAll("a[href]").forEach((node) => {
    const a = node as HTMLAnchorElement;
    if (a.dataset.xbNav) return;
    a.removeAttribute("aria-current");
  });
}

export function setNavActive(active: boolean) {
  const link = document.querySelector(
    `#${NAV_ID} a`,
  ) as HTMLAnchorElement | null;
  if (link) {
    link.dataset.xbActive = active ? "true" : "false";
    link.classList.toggle("xb-nav-active", active);
    if (active) {
      link.setAttribute("aria-current", "page");
      clearNativeNavSelection();
    } else {
      link.removeAttribute("aria-current");
    }
    const wrap = link.querySelector(".xb-nav-icon-wrap");
    if (wrap) wrap.innerHTML = bookmarkIconSvg(active);
  }

  // Also reflect on native Bookmarks if we hooked it
  const native = findBookmarksLink();
  if (native && active) {
    native.setAttribute("aria-current", "page");
  }
}

/**
 * Inject a gold “XBookmarks” item in the left rail (between Home and Explore).
 */
export function ensureNavItem(onOpen: () => void): void {
  const existingWrap = document.getElementById(NAV_ID);
  if (existingWrap?.isConnected) {
    const existing = existingWrap.querySelector("a") as HTMLAnchorElement | null;
    if (existing && !existing.dataset.xbBound) {
      existing.dataset.xbBound = "1";
      existing.addEventListener(
        "click",
        (e) => {
          e.preventDefault();
          e.stopPropagation();
          onOpen();
        },
        true,
      );
    }
    existing?.classList.add("xb-nav-gold");
    return;
  }

  // Stale node left in memory but detached — drop it
  existingWrap?.remove();

  const { home, explore, container } = findHomeAndExplore();
  if (!container && !home && !explore) return;

  const reference = home || explore;
  const wrapper = document.createElement("div");
  wrapper.id = NAV_ID;
  // Match sibling wrapper class when Home lives in a nested div
  wrapper.className =
    home?.parentElement?.className ||
    explore?.parentElement?.className ||
    "";

  const link = document.createElement("a");
  link.href = BOOKMARKS_PATH;
  link.setAttribute("aria-label", "XBookmarks");
  link.setAttribute("role", "link");
  link.dataset.xbNav = "true";
  link.className = `${reference?.className || ""} xb-nav-gold`.trim();
  link.innerHTML = `
    <div class="xb-nav-inner">
      <div class="xb-nav-icon-wrap">${bookmarkIconSvg(false)}</div>
      <span class="xb-nav-label">XBookmarks</span>
    </div>
  `;

  link.dataset.xbBound = "1";
  link.addEventListener(
    "click",
    (e) => {
      e.preventDefault();
      e.stopPropagation();
      onOpen();
    },
    true,
  );

  wrapper.appendChild(link);

  if (home?.parentElement) {
    home.parentElement.insertAdjacentElement("afterend", wrapper);
  } else if (explore?.parentElement) {
    explore.parentElement.insertAdjacentElement("beforebegin", wrapper);
  } else if (container) {
    container.insertBefore(wrapper, container.children[1] || null);
  }

  setNavActive(
    location.pathname.startsWith(BOOKMARKS_PATH) ||
      location.pathname.startsWith(XBOOKMARKS_PATH),
  );
}

/**
 * Also hook native Bookmarks so either entry opens our folder UI.
 */
export function ensureBookmarksHook(onOpen: () => void): void {
  const link = findBookmarksLink();
  if (!link || link.dataset.xbNav) return;

  if (link.dataset.xbBookmarksHook === "1") return;
  link.dataset.xbBookmarksHook = "1";

  if (!document.getElementById(HOOK_META_ID)) {
    const marker = document.createElement("meta");
    marker.id = HOOK_META_ID;
    marker.setAttribute("data-xb", "bookmarks-hooked");
    document.documentElement.appendChild(marker);
  }

  link.addEventListener(
    "click",
    (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (location.pathname.startsWith(BOOKMARKS_PATH)) {
        onOpen();
        return;
      }
      history.pushState({}, "", BOOKMARKS_PATH);
      window.dispatchEvent(new PopStateEvent("popstate"));
      onOpen();
    },
    true,
  );
}

export function isBookmarksRoute(): boolean {
  return location.pathname.startsWith(BOOKMARKS_PATH);
}

export function isXBookmarksRoute(): boolean {
  return (
    location.pathname.startsWith(BOOKMARKS_PATH) ||
    location.pathname.startsWith(XBOOKMARKS_PATH)
  );
}

/** True if an anchor is a primary X nav destination (not our item / Bookmarks). */
export function isForeignPrimaryNavLink(anchor: HTMLAnchorElement): boolean {
  if (anchor.dataset.xbNav) return false;
  const href = anchor.getAttribute("href") || "";
  if (!href.startsWith("/")) return false;
  if (href.startsWith(BOOKMARKS_PATH) || href.startsWith(XBOOKMARKS_PATH)) {
    return false;
  }
  return (
    href === "/home" ||
    href === "/explore" ||
    href === "/notifications" ||
    href === "/messages" ||
    href.startsWith("/i/premium") ||
    href.startsWith("/i/lists") ||
    href.startsWith("/i/communities") ||
    !!anchor.closest('nav[aria-label="Primary"], nav[role="navigation"]')
  );
}
