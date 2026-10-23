/** Native X Bookmarks route — folders live here, like Premium. */
export const BOOKMARKS_PATH = "/i/bookmarks";
/** Legacy path from earlier builds; redirect to Bookmarks. */
export const XBOOKMARKS_PATH = "/i/xbookmarks";

const NAV_ID = "xbookmarks-nav-hook";

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

/** Soften X's selected look on other primary nav when our Bookmarks view is open. */
export function clearNativeNavSelection(exceptBookmarks = true) {
  const root =
    document.querySelector('nav[aria-label="Primary"]') ||
    document.querySelector('nav[role="navigation"]') ||
    document.body;

  root.querySelectorAll("a[href]").forEach((node) => {
    const a = node as HTMLAnchorElement;
    const href = a.getAttribute("href") || "";
    if (exceptBookmarks && href.startsWith(BOOKMARKS_PATH)) return;
    a.removeAttribute("aria-current");
  });
}

export function setNavActive(active: boolean) {
  const link = findBookmarksLink();
  if (!link) return;

  if (active) {
    link.setAttribute("aria-current", "page");
    clearNativeNavSelection(true);
  }
}

/**
 * Hook the native Bookmarks nav item so opening it shows our folder UI.
 * Does not add a separate left-rail item — you stay in normal X.
 */
export function ensureBookmarksHook(onOpen: () => void): void {
  const link = findBookmarksLink();
  if (!link) return;

  if (link.dataset.xbBookmarksHook === "1") return;
  link.dataset.xbBookmarksHook = "1";

  // Marker for debugging / CSS if needed
  if (!document.getElementById(NAV_ID)) {
    const marker = document.createElement("meta");
    marker.id = NAV_ID;
    marker.setAttribute("data-xb", "bookmarks-hooked");
    document.documentElement.appendChild(marker);
  }

  link.addEventListener(
    "click",
    (e) => {
      // Let X navigate to /i/bookmarks, then we mount on that route.
      // Also open immediately so the swap feels instant.
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

/** @deprecated use ensureBookmarksHook — kept name for soft migration */
export function ensureNavItem(onOpen: () => void): void {
  ensureBookmarksHook(onOpen);
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

/** True if an anchor is a primary X nav destination (not Bookmarks while we own it). */
export function isForeignPrimaryNavLink(anchor: HTMLAnchorElement): boolean {
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
