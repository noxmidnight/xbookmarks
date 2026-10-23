import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import BookmarkAddIcon from "@mui/icons-material/BookmarkAdd";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Paper from "@mui/material/Paper";
import Snackbar from "@mui/material/Snackbar";
import Typography from "@mui/material/Typography";
import { SaveTweetDialog } from "../components/SaveTweetDialog";
import {
  bindFeedResizeListener,
  FEED_BOTTOM_RESERVE_PX,
  hideXFeed,
  isNativeApp,
  openXFeed,
  readLiveFeedUrl,
  setFeedUiSuspended,
  showXFeed,
  tweetIdFromFeedUrl,
  X_FEED_URL,
} from "../lib/xFeed";

export function FeedPage() {
  const navigate = useNavigate();
  const native = isNativeApp();
  const [feedUrl, setFeedUrl] = useState(X_FEED_URL);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerTweetId, setPickerTweetId] = useState<string | null>(null);
  const [pickerPermalink, setPickerPermalink] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [feedError, setFeedError] = useState<string | null>(null);
  const [resolving, setResolving] = useState(false);

  const tweetId = tweetIdFromFeedUrl(feedUrl);

  const openPickerForUrl = useCallback((url: string) => {
    setFeedUrl(url);
    const id = tweetIdFromFeedUrl(url);
    if (!id) {
      setToast("Open a tweet first, then tap Bookmark.");
      return;
    }
    const permalink = url.split("?")[0] || url;
    setPickerTweetId(id);
    setPickerPermalink(permalink);
    setFeedUiSuspended(true);
    void hideXFeed().then(() => setPickerOpen(true));
  }, []);

  const onBookmark = useCallback(async () => {
    setResolving(true);
    try {
      const url = await readLiveFeedUrl();
      openPickerForUrl(url);
    } finally {
      setResolving(false);
    }
  }, [openPickerForUrl]);

  useEffect(() => {
    if (!native) return;

    let cancelled = false;
    const unbindResize = bindFeedResizeListener();

    void (async () => {
      try {
        await openXFeed({
          onUrlChange: (url) => {
            if (!cancelled) setFeedUrl(url);
          },
          onSaveRequest: (url) => {
            if (!cancelled) openPickerForUrl(url);
          },
        });
      } catch (err) {
        if (!cancelled) {
          setFeedError(
            err instanceof Error ? err.message : "Could not open X feed",
          );
        }
      }
    })();

    return () => {
      cancelled = true;
      unbindResize();
      // Do NOT hide/close here — Shell owns tab visibility so X login survives
      // switching away from Feed and back.
    };
  }, [native, openPickerForUrl]);

  function onPickerClose() {
    setPickerOpen(false);
    setFeedUiSuspended(false);
    void showXFeed();
  }

  function onSaved(folderId: string | null) {
    setPickerOpen(false);
    setFeedUiSuspended(false);
    setToast("Saved to XBookmarks");
    if (folderId) {
      void hideXFeed();
      setTimeout(() => navigate(`/folder/${folderId}`), 400);
    } else {
      void showXFeed();
    }
  }

  if (!native) {
    return (
      <Box sx={{ py: 3 }}>
        <Typography variant="h5" sx={{ color: "primary.light", mb: 1 }}>
          Feed
        </Typography>
        <Alert severity="info" sx={{ mb: 2 }}>
          The in-app X feed runs in the Android app. Install the Capacitor APK
          to browse your timeline and bookmark without switching apps.
        </Alert>
        <Typography color="text.secondary" variant="body2">
          On phone: open a tweet → tap Bookmark → pick a folder. Saved posts
          show under Folders / All.
        </Typography>
        <Box sx={{ mt: 2 }}>
          <Typography
            component="a"
            href={X_FEED_URL}
            target="_blank"
            rel="noreferrer"
            sx={{ color: "primary.light" }}
          >
            Open x.com in browser
          </Typography>
        </Box>
      </Box>
    );
  }

  return (
    <>
      <Box
        sx={{
          minHeight: `calc(100dvh - ${FEED_BOTTOM_RESERVE_PX}px)`,
          bgcolor: "transparent",
        }}
      />

      <Paper
        elevation={0}
        sx={{
          position: "fixed",
          left: 0,
          right: 0,
          bottom: "calc(56px + env(safe-area-inset-bottom, 0px))",
          zIndex: 11,
          px: 1.5,
          py: 1,
          display: "flex",
          alignItems: "center",
          gap: 1,
          borderRadius: 0,
          borderLeft: "none",
          borderRight: "none",
          borderBottom: "none",
          bgcolor: "background.paper",
        }}
      >
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ flex: 1, minWidth: 0 }}
          noWrap
        >
          {tweetId
            ? "Tweet open — save to a folder"
            : "Open a tweet, then tap Bookmark"}
        </Typography>
        <Button
          size="small"
          variant="contained"
          startIcon={<BookmarkAddIcon />}
          disabled={resolving}
          onClick={() => void onBookmark()}
        >
          {resolving ? "…" : "Bookmark"}
        </Button>
      </Paper>

      {feedError ? (
        <Alert
          severity="error"
          sx={{ position: "fixed", top: 8, left: 8, right: 8, zIndex: 30 }}
        >
          {feedError}
        </Alert>
      ) : null}

      <SaveTweetDialog
        open={pickerOpen}
        tweetId={pickerTweetId}
        permalink={pickerPermalink}
        onClose={onPickerClose}
        onSaved={onSaved}
      />

      <Snackbar
        open={Boolean(toast)}
        autoHideDuration={2500}
        onClose={() => setToast(null)}
        message={toast}
        anchorOrigin={{ vertical: "top", horizontal: "center" }}
      />
    </>
  );
}
