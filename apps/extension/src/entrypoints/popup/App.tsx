import { useCallback, useEffect, useState } from "react";
import {
  FOLDER_COLOR_HEX,
  FOLDER_COLORS,
  type Folder,
  type FolderColor,
} from "@xbookmarks/shared";
import type { ExtensionMessage, ExtensionResponse } from "../../lib/messages";
import type { LocalLibrary } from "../../lib/local-store";
import "./style.css";

async function send<T = unknown>(message: ExtensionMessage): Promise<T> {
  const res = (await browser.runtime.sendMessage(message)) as ExtensionResponse;
  if (!res.ok) throw new Error(res.error);
  return res.data as T;
}

export function App() {
  const [folders, setFolders] = useState<Folder[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [totalBookmarks, setTotalBookmarks] = useState(0);
  const [name, setName] = useState("");
  const [color, setColor] = useState<FolderColor>("sky");
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pageReady, setPageReady] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [list, folderCounts, bookmarks] = await Promise.all([
        send<Folder[]>({ type: "LIST_FOLDERS" }),
        send<Record<string, number>>({ type: "COUNT_BY_FOLDER" }),
        send<unknown[]>({ type: "LIST_BOOKMARKS" }),
      ]);
      setFolders(list);
      setCounts(folderCounts);
      setTotalBookmarks(bookmarks.length);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    void checkContentScript();
  }, [refresh]);

  async function checkContentScript() {
    try {
      const [tab] = await browser.tabs.query({
        active: true,
        currentWindow: true,
      });
      if (
        !tab?.id ||
        (!tab.url?.includes("x.com") && !tab.url?.includes("twitter.com"))
      ) {
        setPageReady(false);
        return;
      }
      const res = (await browser.tabs.sendMessage(tab.id, {
        type: "PING_CONTENT",
      })) as ExtensionResponse | undefined;
      setPageReady(Boolean(res?.ok));
    } catch {
      setPageReady(false);
    }
  }

  async function onCreateFolder(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setError(null);
    try {
      await send({ type: "CREATE_FOLDER", name: name.trim(), color });
      setName("");
      setStatus(`Folder “${name.trim()}” saved locally.`);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create folder");
    }
  }

  async function onDeleteFolder(folder: Folder) {
    if (
      !confirm(
        `Delete “${folder.name}”? Bookmarks stay on this device; they become uncategorized.`,
      )
    ) {
      return;
    }
    try {
      await send({ type: "DELETE_FOLDER", folderId: folder.id });
      setStatus("Folder deleted.");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    }
  }

  async function onImportBookmarks() {
    try {
      const [tab] = await browser.tabs.query({
        active: true,
        currentWindow: true,
      });
      if (!tab?.id) throw new Error("No active tab");
      if (!tab.url?.includes("/i/bookmarks")) {
        await browser.tabs.update(tab.id, {
          url: "https://x.com/i/bookmarks",
        });
        setStatus("Opening bookmarks — reopen popup and click Import again.");
        return;
      }
      await browser.tabs.sendMessage(tab.id, { type: "START_IMPORT" });
      setStatus("Import started — posts are saved locally in this browser.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed");
    }
  }

  async function onExport() {
    try {
      const library = await send<LocalLibrary>({ type: "EXPORT_LIBRARY" });
      const blob = new Blob([JSON.stringify(library, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `xbookmarks-local-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setStatus("Exported local library JSON.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Export failed");
    }
  }

  async function onClear() {
    if (
      !confirm(
        "Clear ALL local folders and bookmarks from this browser? This cannot be undone.",
      )
    ) {
      return;
    }
    try {
      await send({ type: "CLEAR_LIBRARY" });
      setStatus("Local library cleared.");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Clear failed");
    }
  }

  if (loading) {
    return (
      <div className="popup">
        <p className="muted">Loading…</p>
      </div>
    );
  }

  return (
    <div className="popup">
      <header className="header">
        <div>
          <strong className="title">XBookmarks</strong>
          <div className="muted tiny">
            Local storage · {totalBookmarks} bookmark
            {totalBookmarks === 1 ? "" : "s"}
          </div>
          <div className="muted tiny">
            Page script:{" "}
            {pageReady === null
              ? "…"
              : pageReady
                ? "ready on x.com"
                : "open/reload x.com"}
          </div>
        </div>
      </header>

      {error ? <p className="error">{error}</p> : null}
      {status ? <p className="ok">{status}</p> : null}

      <div className="stack">
        <section className="stack">
          <strong>Folders</strong>
          {folders.length === 0 ? (
            <p className="muted">No folders yet — create one below.</p>
          ) : (
            <ul className="folder-list">
              {folders.map((f) => (
                <li key={f.id}>
                  <span
                    className="dot"
                    style={{ background: FOLDER_COLOR_HEX[f.color] }}
                  />
                  <span className="folder-label">
                    {f.name}
                    <span className="muted tiny">
                      {" "}
                      ({counts[f.id] ?? 0})
                    </span>
                  </span>
                  <button
                    type="button"
                    className="btn ghost tiny-btn"
                    onClick={() => void onDeleteFolder(f)}
                  >
                    Delete
                  </button>
                </li>
              ))}
            </ul>
          )}

          <form className="stack" onSubmit={onCreateFolder}>
            <input
              className="input"
              placeholder="New folder name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <div className="swatches">
              {FOLDER_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  className={`swatch${color === c ? " on" : ""}`}
                  style={{ background: FOLDER_COLOR_HEX[c] }}
                  onClick={() => setColor(c)}
                  aria-label={c}
                />
              ))}
            </div>
            <button className="btn" type="submit">
              Create folder
            </button>
          </form>
        </section>

        <button
          className="btn secondary"
          type="button"
          onClick={() => void onImportBookmarks()}
        >
          Import from /i/bookmarks
        </button>

        <div className="row">
          <button
            className="btn secondary"
            type="button"
            onClick={() => void onExport()}
          >
            Export JSON
          </button>
          <button
            className="btn ghost"
            type="button"
            onClick={() => void onClear()}
          >
            Clear all
          </button>
        </div>

        <p className="muted tiny">
          On x.com, click the bookmark icon to save a post into a local folder.
          Data stays in this browser profile (chrome.storage.local).
        </p>
      </div>
    </div>
  );
}
