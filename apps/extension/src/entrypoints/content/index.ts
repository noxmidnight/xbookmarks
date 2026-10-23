import "./picker.css";
import {
  FOLDER_COLOR_HEX,
  type CapturedTweet,
  type Folder,
} from "@xbookmarks/shared";
import type { ExtensionMessage } from "../../lib/messages";
import {
  SELECTORS,
  extractTweetFromArticle,
  findTweetArticle,
} from "../../lib/tweet-dom";
import { sendMessage, showToast } from "./messaging";
import {
  ensureBookmarksHook,
  ensureNavItem,
  isForeignPrimaryNavLink,
  isXBookmarksRoute,
  setNavActive,
} from "./nav";
import {
  isLibraryOpen,
  leaveLibraryView,
  openLibraryView,
  rehideNativeIfNeeded,
  syncLibraryRoute,
} from "./library-view";

export default defineContentScript({
  matches: ["*://x.com/*", "*://twitter.com/*"],
  runAt: "document_idle",
  main() {
    let folders: Folder[] = [];
    let pickerEl: HTMLDivElement | null = null;

    void refreshFolders();
    bootNavAndRoute();

    let navScheduled = false;
    const observer = new MutationObserver(() => {
      if (navScheduled) return;
      navScheduled = true;
      window.setTimeout(() => {
        navScheduled = false;
        ensureNavItem(() => void openLibraryView());
        ensureBookmarksHook(() => void openLibraryView());
        if (isLibraryOpen()) {
          if (!document.getElementById("xbookmarks-library-view")) {
            void syncLibraryRoute();
          } else {
            rehideNativeIfNeeded();
            setNavActive(true);
          }
        } else if (isXBookmarksRoute()) {
          void syncLibraryRoute();
        }
      }, 80);
    });
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
    });

    window.addEventListener("popstate", () => {
      syncLibraryRoute();
    });

    document.addEventListener(
      "click",
      (event) => {
        const target = event.target as Element | null;
        if (!target) return;

        if (pickerEl && !pickerEl.contains(target)) {
          closePicker();
        }

        const navLink = target.closest("a[href]") as HTMLAnchorElement | null;
        if (navLink && isLibraryOpen() && isForeignPrimaryNavLink(navLink)) {
          const href = navLink.getAttribute("href") || "/home";
          event.preventDefault();
          event.stopPropagation();
          leaveLibraryView(href);
          window.setTimeout(() => {
            if (
              location.pathname === href ||
              location.pathname.startsWith(href + "?")
            ) {
              return;
            }
            location.assign(href);
          }, 100);
          return;
        }

        const bookmarkBtn = target.closest(SELECTORS.bookmarkButton);
        if (!bookmarkBtn) return;

        const article = findTweetArticle(bookmarkBtn);
        if (!article) return;

        const tweet = extractTweetFromArticle(article);
        if (!tweet) return;

        window.setTimeout(() => {
          void openPicker(bookmarkBtn as HTMLElement, tweet);
        }, 80);
      },
      true,
    );

    browser.runtime.onMessage.addListener((message: ExtensionMessage) => {
      if (message.type === "START_IMPORT") {
        void openLibraryView();
        showToast("Open Bookmarks → use “Import from X”");
      }
      if (message.type === "PING_CONTENT") {
        return Promise.resolve({ ok: true, data: "content-alive" });
      }
      return undefined;
    });

    function bootNavAndRoute() {
      ensureNavItem(() => void openLibraryView());
      ensureBookmarksHook(() => void openLibraryView());
      if (isXBookmarksRoute()) {
        void syncLibraryRoute();
      }
    }

    async function refreshFolders() {
      try {
        folders = await sendMessage<Folder[]>({ type: "LIST_FOLDERS" });
      } catch {
        folders = await sendMessage<Folder[]>({ type: "GET_CACHED_FOLDERS" });
      }
    }

    function closePicker() {
      pickerEl?.remove();
      pickerEl = null;
    }

    async function openPicker(anchor: HTMLElement, tweet: CapturedTweet) {
      closePicker();
      await refreshFolders();

      const rect = anchor.getBoundingClientRect();
      pickerEl = document.createElement("div");
      pickerEl.className = "xb-picker";
      pickerEl.style.top = `${window.scrollY + rect.bottom + 8}px`;
      pickerEl.style.left = `${window.scrollX + Math.min(rect.left, window.innerWidth - 260)}px`;

      const title = document.createElement("div");
      title.className = "xb-picker-title";
      title.textContent = "Save to folder";
      pickerEl.appendChild(title);

      if (folders.length === 0) {
        const empty = document.createElement("div");
        empty.style.padding = "0.5rem 0.75rem";
        empty.style.color = "#71767b";
        empty.style.fontSize = "13px";
        empty.textContent = "No folders yet — create one below.";
        pickerEl.appendChild(empty);
      }

      for (const folder of folders) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "xb-picker-item";
        const dot = document.createElement("span");
        dot.className = "xb-dot";
        dot.style.background = FOLDER_COLOR_HEX[folder.color];
        btn.appendChild(dot);
        btn.appendChild(document.createTextNode(folder.name));
        btn.addEventListener("click", async (e) => {
          e.preventDefault();
          e.stopPropagation();
          try {
            await sendMessage({
              type: "SAVE_BOOKMARK",
              tweet,
              folderIds: [folder.id],
            });
            showToast(`Saved to “${folder.name}”`);
            closePicker();
          } catch (err) {
            showToast(
              err instanceof Error ? err.message : "Failed to save bookmark",
            );
          }
        });
        pickerEl.appendChild(btn);
      }

      const uncategorized = document.createElement("button");
      uncategorized.type = "button";
      uncategorized.className = "xb-picker-item";
      uncategorized.textContent = "Uncategorized";
      uncategorized.addEventListener("click", async (e) => {
        e.preventDefault();
        e.stopPropagation();
        try {
          await sendMessage({ type: "SAVE_BOOKMARK", tweet, folderIds: [] });
          showToast("Saved (uncategorized)");
          closePicker();
        } catch (err) {
          showToast(
            err instanceof Error ? err.message : "Failed to save bookmark",
          );
        }
      });
      pickerEl.appendChild(uncategorized);

      const create = document.createElement("div");
      create.className = "xb-picker-create";
      const input = document.createElement("input");
      input.type = "text";
      input.placeholder = "New folder name";
      input.maxLength = 40;
      const createBtn = document.createElement("button");
      createBtn.type = "button";
      createBtn.className = "xb-picker-create-btn";
      createBtn.textContent = "Create & save here";
      const doCreate = async () => {
        const name = input.value.trim();
        if (!name) {
          showToast("Enter a folder name");
          return;
        }
        try {
          const folder = await sendMessage<Folder>({
            type: "CREATE_FOLDER",
            name,
          });
          await sendMessage({
            type: "SAVE_BOOKMARK",
            tweet,
            folderIds: [folder.id],
          });
          showToast(`Saved to “${folder.name}”`);
          closePicker();
        } catch (err) {
          showToast(err instanceof Error ? err.message : "Create failed");
        }
      };
      createBtn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        void doCreate();
      });
      input.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          e.stopPropagation();
          void doCreate();
        }
      });
      create.appendChild(input);
      create.appendChild(createBtn);
      pickerEl.appendChild(create);

      document.body.appendChild(pickerEl);
      input.focus();
    }
  },
});
