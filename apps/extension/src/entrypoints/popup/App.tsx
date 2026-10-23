import { useCallback, useEffect, useState } from "react";
import {
  FOLDER_COLOR_HEX,
  FOLDER_COLORS,
  type Folder,
  type FolderColor,
} from "@xbookmarks/shared";
import type { ExtensionMessage, ExtensionResponse } from "../../lib/messages";
import type { SyncResult } from "../../lib/cloud-sync";
import "./style.css";

const OWNER_EMAIL = (
  import.meta.env.VITE_OWNER_EMAIL as string | undefined
)?.trim() || "";

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
  const [syncEmail, setSyncEmail] = useState<string | null>(null);
  const [otpEmail, setOtpEmail] = useState(OWNER_EMAIL);
  const [otpUserId, setOtpUserId] = useState<string | null>(null);
  const [otpCode, setOtpCode] = useState("");
  const [syncBusy, setSyncBusy] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const mode = await send<{ mode: string; email: string | null }>({
        type: "GET_STORAGE_MODE",
      });
      setSyncEmail(mode.email);

      if (!mode.email) {
        setFolders([]);
        setCounts({});
        setTotalBookmarks(0);
        return;
      }

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
      setFolders([]);
      setCounts({});
      setTotalBookmarks(0);
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
      setStatus(`Folder “${name.trim()}” saved to Appwrite.`);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create folder");
    }
  }

  async function onDeleteFolder(folder: Folder) {
    if (
      !confirm(
        `Delete “${folder.name}”? Bookmarks stay; they become uncategorized.`,
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
      setStatus("Import started — posts save straight to Appwrite.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed");
    }
  }

  async function onExport() {
    try {
      const library = await send<{ folders: Folder[]; bookmarks: unknown[] }>({
        type: "EXPORT_LIBRARY",
      });
      const blob = new Blob([JSON.stringify(library, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `xbookmarks-cloud-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setStatus("Exported Appwrite library JSON.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Export failed");
    }
  }

  async function onRequestOtp(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSyncBusy(true);
    try {
      const email = otpEmail.trim().toLowerCase();
      if (OWNER_EMAIL && email !== OWNER_EMAIL) {
        throw new Error(`Only ${OWNER_EMAIL} can sign in.`);
      }
      const { userId } = await send<{ userId: string }>({
        type: "CLOUD_REQUEST_OTP",
        email,
      });
      setOtpUserId(userId);
      setStatus("Check your email for a 6-digit code.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "OTP failed");
    } finally {
      setSyncBusy(false);
    }
  }

  async function onVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    if (!otpUserId) return;
    setError(null);
    setSyncBusy(true);
    try {
      const result = await send<{ sync: SyncResult }>({
        type: "CLOUD_VERIFY_OTP",
        userId: otpUserId,
        secret: otpCode,
        email: otpEmail.trim().toLowerCase(),
      });
      setOtpCode("");
      setOtpUserId(null);
      setStatus(
        `Signed in — ${result.sync.bookmarks} bookmarks, ${result.sync.folders} folders from Appwrite.`,
      );
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verify failed");
    } finally {
      setSyncBusy(false);
    }
  }

  async function onSyncNow() {
    setError(null);
    setSyncBusy(true);
    try {
      const result = await send<SyncResult>({ type: "SYNC_NOW" });
      setStatus(
        `Refreshed: ${result.bookmarks} bookmarks · ${result.folders} folders.`,
      );
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Refresh failed");
    } finally {
      setSyncBusy(false);
    }
  }

  async function onSignOut() {
    try {
      await send({ type: "SIGN_OUT" });
      setSyncEmail(null);
      setFolders([]);
      setCounts({});
      setTotalBookmarks(0);
      setStatus("Signed out.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign out failed");
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
            {syncEmail
              ? `Appwrite · ${syncEmail}`
              : "Sign in required — same account as the phone app"}
            {syncEmail
              ? ` · ${totalBookmarks} bookmark${totalBookmarks === 1 ? "" : "s"}`
              : null}
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

      <section className="stack sync-box">
        <strong>Appwrite account</strong>
        {syncEmail ? (
          <>
            <button
              className="btn"
              type="button"
              disabled={syncBusy}
              onClick={() => void onSyncNow()}
            >
              {syncBusy ? "Refreshing…" : "Refresh from cloud"}
            </button>
            <button
              className="btn ghost"
              type="button"
              onClick={() => void onSignOut()}
            >
              Sign out
            </button>
          </>
        ) : (
          <form
            className="stack"
            onSubmit={otpUserId ? onVerifyOtp : onRequestOtp}
          >
            <input
              className="input"
              type="email"
              required
              placeholder="Email"
              value={otpEmail}
              disabled={Boolean(otpUserId) || syncBusy}
              onChange={(e) => setOtpEmail(e.target.value)}
            />
            {otpUserId ? (
              <input
                className="input"
                type="text"
                required
                inputMode="numeric"
                placeholder="6-digit code"
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value)}
              />
            ) : null}
            <button className="btn" type="submit" disabled={syncBusy}>
              {syncBusy
                ? "Please wait…"
                : otpUserId
                  ? "Verify & load library"
                  : "Email me a code"}
            </button>
            {otpUserId ? (
              <button
                className="btn ghost"
                type="button"
                onClick={() => {
                  setOtpUserId(null);
                  setOtpCode("");
                }}
              >
                Different email
              </button>
            ) : null}
          </form>
        )}
        <p className="muted tiny">
          Folders and bookmarks live only in Appwrite — desktop and phone stay
          in sync. Old browser-local folders are cleared on sign-in.
        </p>
      </section>

      {!syncEmail ? (
        <p className="muted">
          Sign in above to manage folders and bookmark from x.com.
        </p>
      ) : (
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

          <button
            className="btn secondary"
            type="button"
            onClick={() => void onExport()}
          >
            Export JSON
          </button>

          <p className="muted tiny">
            Bookmark on x.com → folder picker. Saves go to Appwrite for the
            phone app.
          </p>
        </div>
      )}
    </div>
  );
}
