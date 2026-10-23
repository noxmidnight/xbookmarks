import { useState } from "react";
import { useNavigate } from "react-router-dom";
import type { BookmarkWithFolders, Folder } from "@xbookmarks/shared";
import {
  FOLDER_COLOR_HEX,
  deleteBookmark,
  enrichTweetFromId,
  saveBookmark,
  setBookmarkFolders,
  urlsToMediaItems,
} from "@xbookmarks/shared";
import { appwrite } from "../lib/appwrite";
import { isNativeApp, openUrlInFeed } from "../lib/xFeed";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Checkbox from "@mui/material/Checkbox";
import Chip from "@mui/material/Chip";
import Collapse from "@mui/material/Collapse";
import Dialog from "@mui/material/Dialog";
import FormControlLabel from "@mui/material/FormControlLabel";
import IconButton from "@mui/material/IconButton";
import Link from "@mui/material/Link";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import CloseIcon from "@mui/icons-material/Close";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import RefreshIcon from "@mui/icons-material/Refresh";
import { TweetText } from "./TweetText";

interface Props {
  bookmarks: BookmarkWithFolders[];
  folders: Folder[];
  onChanged: () => void;
}

function TweetMedia({ urls }: { urls: string[] }) {
  const items = urlsToMediaItems(urls);
  const [lightbox, setLightbox] = useState<string | null>(null);
  if (items.length === 0) return null;

  const countClass =
    items.length === 1
      ? "one"
      : items.length === 2
        ? "two"
        : items.length === 3
          ? "three"
          : "four";

  return (
    <>
      <div className={`media-grid ${countClass}`}>
        {items.map((item) => (
          <div
            key={item.url}
            className={`media-cell${item.kind === "video" || item.kind === "gif" ? " media-cell-video" : ""}`}
          >
            {item.kind === "video" ? (
              <video
                src={item.url}
                controls
                playsInline
                preload="metadata"
                poster={item.poster}
              />
            ) : item.kind === "gif" ? (
              <video
                src={item.url}
                autoPlay
                loop
                muted
                playsInline
                preload="metadata"
              />
            ) : (
              <button
                type="button"
                className="media-img-btn"
                onClick={() => setLightbox(item.url)}
              >
                <img
                  src={item.url}
                  alt=""
                  loading="lazy"
                  referrerPolicy="no-referrer"
                />
              </button>
            )}
          </div>
        ))}
      </div>

      <Dialog
        open={Boolean(lightbox)}
        onClose={() => setLightbox(null)}
        maxWidth="lg"
        fullWidth
        slotProps={{
          paper: {
            sx: {
              bgcolor: "#000",
              backgroundImage: "none",
              border: "1px solid rgba(212,160,23,0.5)",
            },
          },
        }}
      >
        <IconButton
          aria-label="Close"
          onClick={() => setLightbox(null)}
          sx={{ position: "absolute", right: 8, top: 8, color: "#f5c518", zIndex: 1 }}
        >
          <CloseIcon />
        </IconButton>
        {lightbox ? (
          <Box
            component="img"
            src={lightbox}
            alt=""
            referrerPolicy="no-referrer"
            sx={{
              width: "100%",
              maxHeight: "90vh",
              objectFit: "contain",
              display: "block",
            }}
          />
        ) : null}
      </Dialog>
    </>
  );
}

export function BookmarkList({ bookmarks, folders, onChanged }: Props) {
  const navigate = useNavigate();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [openMove, setOpenMove] = useState<string | null>(null);
  const folderById = new Map(folders.map((f) => [f.id, f]));

  function onOpenInFeed(permalink: string) {
    if (isNativeApp()) {
      navigate("/feed");
      void openUrlInFeed(permalink);
      return;
    }
    window.open(permalink, "_blank", "noopener,noreferrer");
  }

  if (bookmarks.length === 0) {
    return (
      <Card>
        <CardContent>
          <Typography color="text.secondary">
            No bookmarks here yet. Share an X post into this app, or save from
            the desktop extension.
          </Typography>
        </CardContent>
      </Card>
    );
  }

  async function onMove(bookmarkId: string, folderId: string, checked: boolean) {
    const bookmark = bookmarks.find((b) => b.id === bookmarkId);
    if (!bookmark) return;
    setBusyId(bookmarkId);
    try {
      const next = new Set(bookmark.folder_ids);
      if (checked) next.add(folderId);
      else next.delete(folderId);
      await setBookmarkFolders(appwrite, bookmarkId, [...next]);
      onChanged();
    } finally {
      setBusyId(null);
    }
  }

  async function onDelete(bookmarkId: string) {
    if (!confirm("Remove this bookmark from XBookmarks?")) return;
    setBusyId(bookmarkId);
    try {
      await deleteBookmark(appwrite, bookmarkId);
      onChanged();
    } finally {
      setBusyId(null);
    }
  }

  async function onRefresh(bookmark: BookmarkWithFolders) {
    setBusyId(bookmark.id);
    try {
      const enriched = await enrichTweetFromId(
        bookmark.tweet_id,
        bookmark.permalink,
      );
      await saveBookmark(appwrite, {
        ...enriched,
        folder_ids: bookmark.folder_ids,
      });
      onChanged();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Stack spacing={1.5}>
      {bookmarks.map((b) => (
        <Card key={b.id}>
          <CardContent sx={{ "&:last-child": { pb: 2 } }}>
            <Stack
              direction="row"
              spacing={1}
              sx={{ justifyContent: "space-between", alignItems: "flex-start" }}
            >
              <Box sx={{ minWidth: 0, flex: 1 }}>
                <Typography sx={{ fontWeight: 700 }}>
                  {b.author_name}{" "}
                  <Typography
                    component="span"
                    color="text.secondary"
                    sx={{ fontWeight: 400 }}
                  >
                    @{b.author_handle}
                  </Typography>
                </Typography>
              </Box>
              <Stack direction="row" spacing={0.5}>
                <IconButton
                  size="small"
                  aria-label="Refresh media & text"
                  disabled={busyId === b.id}
                  onClick={() => void onRefresh(b)}
                  sx={{ color: "primary.light" }}
                >
                  <RefreshIcon fontSize="small" />
                </IconButton>
                <Button
                  size="small"
                  variant="outlined"
                  endIcon={<OpenInNewIcon />}
                  onClick={() => onOpenInFeed(b.permalink)}
                >
                  Open
                </Button>
              </Stack>
            </Stack>

            <TweetText text={b.text || ""} />

            <TweetMedia urls={b.media_urls} />

            <Stack direction="row" sx={{ flexWrap: "wrap", gap: 0.75, mt: 1.25 }}>
              {b.folder_ids.length === 0 ? (
                <Chip size="small" variant="outlined" label="Uncategorized" />
              ) : (
                b.folder_ids.map((id) => {
                  const folder = folderById.get(id);
                  if (!folder) return null;
                  return (
                    <Chip
                      key={id}
                      size="small"
                      variant="outlined"
                      label={folder.name}
                      icon={
                        <Box
                          sx={{
                            width: 8,
                            height: 8,
                            borderRadius: "50%",
                            bgcolor: FOLDER_COLOR_HEX[folder.color],
                            ml: 1,
                          }}
                        />
                      }
                    />
                  );
                })
              )}
            </Stack>

            <Link
              component="button"
              type="button"
              variant="body2"
              underline="hover"
              color="primary"
              sx={{ mt: 1.25, display: "inline-block" }}
              onClick={() =>
                setOpenMove((cur) => (cur === b.id ? null : b.id))
              }
            >
              {openMove === b.id ? "Hide folders" : "Move to folders"}
            </Link>

            <Collapse in={openMove === b.id}>
              <Stack spacing={0.5} sx={{ mt: 1 }}>
                {folders.map((folder) => (
                  <FormControlLabel
                    key={folder.id}
                    control={
                      <Checkbox
                        size="small"
                        disabled={busyId === b.id}
                        checked={b.folder_ids.includes(folder.id)}
                        onChange={(e) =>
                          onMove(b.id, folder.id, e.target.checked)
                        }
                        sx={{ color: "primary.main" }}
                      />
                    }
                    label={
                      <Stack
                        direction="row"
                        spacing={1}
                        sx={{ alignItems: "center" }}
                      >
                        <Box
                          sx={{
                            width: 10,
                            height: 10,
                            borderRadius: "50%",
                            bgcolor: FOLDER_COLOR_HEX[folder.color],
                          }}
                        />
                        <span>{folder.name}</span>
                      </Stack>
                    }
                  />
                ))}
                {folders.length === 0 ? (
                  <Typography color="text.secondary" variant="body2">
                    Create a folder first.
                  </Typography>
                ) : null}
                <Button
                  color="error"
                  variant="outlined"
                  size="small"
                  disabled={busyId === b.id}
                  onClick={() => onDelete(b.id)}
                  sx={{ alignSelf: "flex-start", mt: 0.5 }}
                >
                  Delete
                </Button>
              </Stack>
            </Collapse>
          </CardContent>
        </Card>
      ))}
    </Stack>
  );
}
