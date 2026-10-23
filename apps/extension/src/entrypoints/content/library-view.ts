import {
  FOLDER_COLORS,
  FOLDER_COLOR_HEX,
  type BookmarkWithFolders,
  type Folder,
  type FolderColor,
} from "@xbookmarks/shared";
import { extractTweetsFromBookmarksPage } from "../../lib/tweet-dom";
import { sendMessage, showToast } from "./messaging";
import {
  BOOKMARKS_PATH,
  XBOOKMARKS_PATH,
  setNavActive,
} from "./nav";

const VIEW_ID = "xbookmarks-library-view";
const HIDDEN_CLASS = "xb-primary-hidden";

type FilterKey = "all" | "uncategorized" | string;

let libraryOpen = false;
let mounting = false;
let activeFilter: FilterKey = "all";
let folders: Folder[] = [];
let bookmarks: BookmarkWithFolders[] = [];
let createColor: FolderColor = "sky";
let importRunning = false;

export function isLibraryOpen() {
  return libraryOpen;
}

function getPrimaryColumn(): HTMLElement | null {
  return (
    (document.querySelector(
      '[data-testid="primaryColumn"]',
    ) as HTMLElement | null) ||
    (document.querySelector('main[role="main"]') as HTMLElement | null)
  );
}

function hideNativePrimary(hide: boolean) {
  const primary = getPrimaryColumn();
  if (!primary) return;
  if (hide) {
    Array.from(primary.children).forEach((child) => {
      const el = child as HTMLElement;
      if (el.id === VIEW_ID) return;
      el.classList.add(HIDDEN_CLASS);
      el.setAttribute("data-xb-hidden", "1");
    });
  } else {
    primary.querySelectorAll("[data-xb-hidden='1']").forEach((node) => {
      const el = node as HTMLElement;
      el.classList.remove(HIDDEN_CLASS);
      el.removeAttribute("data-xb-hidden");
    });
  }
}

/** Re-hide any new native siblings X injects while our view is open (no remount). */
export function rehideNativeIfNeeded() {
  if (!libraryOpen) return;
  const primary = getPrimaryColumn();
  if (!primary) return;
  const root = document.getElementById(VIEW_ID);
  if (!root) return;
  Array.from(primary.children).forEach((child) => {
    const el = child as HTMLElement;
    if (el.id === VIEW_ID) return;
    if (!el.hasAttribute("data-xb-hidden")) {
      el.classList.add(HIDDEN_CLASS);
      el.setAttribute("data-xb-hidden", "1");
    }
  });
  if (primary.firstElementChild !== root) {
    primary.prepend(root);
  }
}

async function refreshData() {
  folders = await sendMessage<Folder[]>({ type: "LIST_FOLDERS" });
  const folderId =
    activeFilter === "all"
      ? undefined
      : activeFilter === "uncategorized"
        ? null
        : activeFilter;
  bookmarks = await sendMessage<BookmarkWithFolders[]>({
    type: "LIST_BOOKMARKS",
    folderId,
  });
}

export function destroyLibraryView() {
  libraryOpen = false;
  mounting = false;
  document.getElementById(VIEW_ID)?.remove();
  hideNativePrimary(false);
  setNavActive(false);
}

/** Leave folder Bookmarks and navigate to a normal X route. */
export function leaveLibraryView(href = "/home") {
  const next = href.startsWith("/") ? href : "/home";
  if (
    location.pathname.startsWith(BOOKMARKS_PATH) ||
    location.pathname.startsWith(XBOOKMARKS_PATH)
  ) {
    history.pushState({}, "", next);
  }
  destroyLibraryView();
  window.dispatchEvent(new PopStateEvent("popstate"));
}

export async function openLibraryView() {
  if (mounting) return;
  libraryOpen = true;
  if (location.pathname.startsWith(XBOOKMARKS_PATH)) {
    history.replaceState({}, "", BOOKMARKS_PATH);
  } else if (!location.pathname.startsWith(BOOKMARKS_PATH)) {
    history.pushState({ xbookmarks: true }, "", BOOKMARKS_PATH);
  }
  setNavActive(true);
  await mountLibraryView();
}

export async function mountLibraryView() {
  if (mounting) return;
  mounting = true;
  try {
    libraryOpen = true;
    const primary = getPrimaryColumn();
    if (!primary) return;

    hideNativePrimary(true);
    setNavActive(true);

    let root = document.getElementById(VIEW_ID) as HTMLDivElement | null;
    if (!root) {
      root = document.createElement("div");
      root.id = VIEW_ID;
      root.className = "xb-library";
      primary.prepend(root);
    }

    await refreshData();
    render(root);
  } finally {
    mounting = false;
  }
}

function folderTitle(): string {
  if (activeFilter === "all") return "Bookmarks";
  if (activeFilter === "uncategorized") return "Uncategorized";
  return folders.find((f) => f.id === activeFilter)?.name || "Bookmarks";
}

function render(root: HTMLDivElement) {
  root.innerHTML = "";

  const header = document.createElement("div");
  header.className = "xb-lib-header";
  header.innerHTML = `
    <div class="xb-lib-header-row">
      <div class="xb-lib-titles">
        <h1 class="xb-lib-title">${escapeHtml(folderTitle())}</h1>
        <p class="xb-lib-sub">${bookmarks.length} post${bookmarks.length === 1 ? "" : "s"}</p>
      </div>
      <button type="button" class="xb-lib-import" ${importRunning ? "disabled" : ""}>
        ${importRunning ? "Importing…" : "Import from X"}
      </button>
    </div>
  `;
  header.querySelector(".xb-lib-import")?.addEventListener("click", () => {
    void runImportFromNative();
  });
  root.appendChild(header);

  const tabs = document.createElement("div");
  tabs.className = "xb-lib-tabs";
  tabs.appendChild(makeTab("All", "all"));
  tabs.appendChild(makeTab("Uncategorized", "uncategorized"));
  for (const folder of folders) {
    tabs.appendChild(
      makeTab(folder.name, folder.id, FOLDER_COLOR_HEX[folder.color]),
    );
  }
  root.appendChild(tabs);

  const create = document.createElement("div");
  create.className = "xb-lib-create";
  create.innerHTML = `
    <input class="xb-lib-input" type="text" placeholder="New folder name" maxlength="40" />
    <div class="xb-lib-swatches"></div>
    <button type="button" class="xb-lib-create-btn">Create folder</button>
  `;
  const swatches = create.querySelector(".xb-lib-swatches")!;
  for (const c of FOLDER_COLORS) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = `xb-lib-swatch${createColor === c ? " on" : ""}`;
    b.style.background = FOLDER_COLOR_HEX[c];
    b.title = c;
    b.addEventListener("click", () => {
      createColor = c;
      swatches.querySelectorAll(".xb-lib-swatch").forEach((el) => {
        el.classList.toggle(
          "on",
          (el as HTMLElement).style.background === FOLDER_COLOR_HEX[c],
        );
      });
    });
    swatches.appendChild(b);
  }
  const input = create.querySelector(".xb-lib-input") as HTMLInputElement;
  create.querySelector(".xb-lib-create-btn")?.addEventListener("click", () => {
    void createFolder(input.value);
  });
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") void createFolder(input.value);
  });
  root.appendChild(create);

  const feed = document.createElement("div");
  feed.className = "xb-lib-feed";
  feed.setAttribute("aria-label", "Timeline");

  if (bookmarks.length === 0) {
    const empty = document.createElement("div");
    empty.className = "xb-lib-empty";
    empty.innerHTML = `
      <h2>Save posts for later</h2>
      <p>Bookmark any post on X, pick a folder, and it shows up here — same place as Bookmarks, with folders.</p>
    `;
    feed.appendChild(empty);
  } else {
    for (const bookmark of bookmarks) {
      feed.appendChild(renderTweetCard(bookmark));
    }
  }

  root.appendChild(feed);
}

function makeTab(label: string, key: FilterKey, color?: string) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = `xb-lib-tab${activeFilter === key ? " active" : ""}`;
  if (color) {
    const dot = document.createElement("span");
    dot.className = "xb-dot";
    dot.style.background = color;
    btn.appendChild(dot);
  }
  btn.appendChild(document.createTextNode(label));
  btn.addEventListener("click", () => {
    activeFilter = key;
    void mountLibraryView();
  });
  return btn;
}

function avatarColor(handle: string) {
  let hash = 0;
  for (let i = 0; i < handle.length; i++) {
    hash = (hash * 31 + handle.charCodeAt(i)) | 0;
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue} 45% 40%)`;
}

function formatWhen(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function renderTweetCard(bookmark: BookmarkWithFolders) {
  const article = document.createElement("article");
  article.className = "xb-tweet";
  article.setAttribute("role", "article");

  const folderNames = bookmark.folder_ids
    .map((id) => folders.find((f) => f.id === id))
    .filter(Boolean) as Folder[];

  const initial = (bookmark.author_name || bookmark.author_handle || "?")
    .trim()
    .charAt(0)
    .toUpperCase();

  const mediaHtml = renderMediaGrid(bookmark.media_urls);

  article.innerHTML = `
    <div class="xb-tweet-avatar" style="background:${avatarColor(bookmark.author_handle)}">${escapeHtml(initial)}</div>
    <div class="xb-tweet-body">
      <div class="xb-tweet-meta">
        <a class="xb-tweet-name" href="https://x.com/${escapeAttr(bookmark.author_handle)}" target="_blank" rel="noreferrer">${escapeHtml(bookmark.author_name)}</a>
        <span class="xb-tweet-handle">@${escapeHtml(bookmark.author_handle)}</span>
        <span class="xb-tweet-dot">·</span>
        <a class="xb-tweet-time" href="${escapeAttr(bookmark.permalink)}" target="_blank" rel="noreferrer">${escapeHtml(formatWhen(bookmark.bookmarked_at || bookmark.captured_at))}</a>
      </div>
      <div class="xb-tweet-text">${escapeHtml(bookmark.text)}</div>
      ${mediaHtml}
      <div class="xb-tweet-folders"></div>
      <div class="xb-tweet-actions"></div>
    </div>
  `;

  article.addEventListener("click", (e) => {
    const t = e.target as HTMLElement;
    if (t.closest("a, button, select, .xb-tweet-actions")) return;
    window.open(bookmark.permalink, "_blank", "noopener,noreferrer");
  });

  const folderRow = article.querySelector(".xb-tweet-folders")!;
  if (folderNames.length === 0) {
    const chip = document.createElement("span");
    chip.className = "xb-lib-chip";
    chip.textContent = "Uncategorized";
    folderRow.appendChild(chip);
  } else {
    for (const f of folderNames) {
      const chip = document.createElement("span");
      chip.className = "xb-lib-chip";
      chip.innerHTML = `<span class="xb-dot" style="background:${FOLDER_COLOR_HEX[f.color]}"></span>${escapeHtml(f.name)}`;
      folderRow.appendChild(chip);
    }
  }

  const actions = article.querySelector(".xb-tweet-actions")!;

  const open = document.createElement("a");
  open.className = "xb-tweet-action";
  open.href = bookmark.permalink;
  open.target = "_blank";
  open.rel = "noreferrer";
  open.textContent = "View";
  actions.appendChild(open);

  if (folders.length > 0) {
    const select = document.createElement("select");
    select.className = "xb-lib-select";
    select.innerHTML = `<option value="">Folder…</option>`;
    for (const f of folders) {
      const opt = document.createElement("option");
      opt.value = f.id;
      opt.textContent = f.name;
      if (bookmark.folder_ids.includes(f.id)) opt.selected = true;
      select.appendChild(opt);
    }
    select.addEventListener("change", async (e) => {
      e.stopPropagation();
      if (!select.value) return;
      try {
        await sendMessage({
          type: "SET_BOOKMARK_FOLDERS",
          bookmarkId: bookmark.id,
          folderIds: [select.value],
        });
        showToast("Moved");
        await mountLibraryView();
      } catch (err) {
        showToast(err instanceof Error ? err.message : "Move failed");
      }
    });
    actions.appendChild(select);
  }

  const del = document.createElement("button");
  del.type = "button";
  del.className = "xb-tweet-action xb-tweet-action-danger";
  del.textContent = "Remove";
  del.addEventListener("click", async (e) => {
    e.stopPropagation();
    try {
      await sendMessage({ type: "DELETE_BOOKMARK", bookmarkId: bookmark.id });
      showToast("Removed");
      await mountLibraryView();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Delete failed");
    }
  });
  actions.appendChild(del);

  return article;
}

function renderMediaGrid(urls: string[]) {
  const list = (urls || []).filter(Boolean).slice(0, 4);
  if (list.length === 0) return "";
  const countClass =
    list.length === 1
      ? "one"
      : list.length === 2
        ? "two"
        : list.length === 3
          ? "three"
          : "four";
  const imgs = list
    .map(
      (src) =>
        `<div class="xb-media-cell"><img src="${escapeAttr(src)}" alt="" loading="lazy" /></div>`,
    )
    .join("");
  return `<div class="xb-media-grid ${countClass}">${imgs}</div>`;
}

async function createFolder(name: string) {
  const trimmed = name.trim();
  if (!trimmed) {
    showToast("Enter a folder name");
    return;
  }
  try {
    const folder = await sendMessage<Folder>({
      type: "CREATE_FOLDER",
      name: trimmed,
      color: createColor,
    });
    showToast(`Created “${folder.name}”`);
    activeFilter = folder.id;
    await mountLibraryView();
  } catch (err) {
    showToast(err instanceof Error ? err.message : "Could not create folder");
  }
}

/**
 * Briefly reveal native Bookmarks timeline, scroll-import, then remount folders UI.
 */
async function runImportFromNative() {
  if (importRunning) return;
  importRunning = true;
  await mountLibraryView();

  const root = document.getElementById(VIEW_ID);
  hideNativePrimary(false);
  root?.classList.add(HIDDEN_CLASS);

  const capturedIds = new Set<string>();
  let total = 0;
  const maxScrolls = 40;

  try {
    for (let i = 0; i < maxScrolls; i++) {
      const batch = extractTweetsFromBookmarksPage();
      for (const tweet of batch) {
        if (capturedIds.has(tweet.tweet_id)) continue;
        capturedIds.add(tweet.tweet_id);
        await sendMessage({
          type: "SAVE_BOOKMARK",
          tweet,
          folderIds: [],
        });
        total += 1;
      }
      showToast(`Imported ${total} bookmarks…`);
      const before = window.scrollY;
      window.scrollBy(0, window.innerHeight * 0.9);
      await sleep(900);
      if (Math.abs(window.scrollY - before) < 8) break;
    }
    showToast(`Import done — ${total} posts`);
  } catch (err) {
    showToast(err instanceof Error ? err.message : "Import failed");
  } finally {
    importRunning = false;
    root?.classList.remove(HIDDEN_CLASS);
    hideNativePrimary(true);
    await mountLibraryView();
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeAttr(value: string) {
  return escapeHtml(value).replace(/'/g, "&#39;");
}

export function syncLibraryRoute() {
  const onBookmarks = location.pathname.startsWith(BOOKMARKS_PATH);
  const onLegacy = location.pathname.startsWith(XBOOKMARKS_PATH);

  if (onLegacy) {
    history.replaceState({}, "", BOOKMARKS_PATH);
    void openLibraryView();
    return;
  }

  if (onBookmarks) {
    if (!libraryOpen || !document.getElementById(VIEW_ID)) {
      void mountLibraryView();
    } else {
      rehideNativeIfNeeded();
      setNavActive(true);
    }
    return;
  }

  if (libraryOpen) {
    destroyLibraryView();
  }
  setNavActive(false);
}
