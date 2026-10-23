import { useEffect, useState } from "react";
import {
  enrichTweetFromId,
  FOLDER_COLOR_HEX,
  saveBookmark,
} from "@xbookmarks/shared";
import { useFolders } from "../hooks/useLibrary";
import { appwrite } from "../lib/appwrite";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import CircularProgress from "@mui/material/CircularProgress";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import FormControlLabel from "@mui/material/FormControlLabel";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";

interface Props {
  open: boolean;
  tweetId: string | null;
  permalink: string | null;
  onClose: () => void;
  onSaved: (folderId: string | null) => void;
}

export function SaveTweetDialog({
  open,
  tweetId,
  permalink,
  onClose,
  onSaved,
}: Props) {
  const { folders, loading } = useFolders();
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setSelected([]);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (folders.length && selected.length === 0) {
      setSelected([folders[0]!.id]);
    }
  }, [open, folders, selected.length]);

  useEffect(() => {
    if (!open || !tweetId) {
      setPreview(null);
      return;
    }
    let cancelled = false;
    void enrichTweetFromId(tweetId, permalink || undefined).then((tweet) => {
      if (cancelled) return;
      const label =
        tweet.author_handle !== "unknown"
          ? `@${tweet.author_handle}: ${tweet.text.slice(0, 140)}`
          : tweet.text.slice(0, 160) || permalink;
      setPreview(label || null);
    });
    return () => {
      cancelled = true;
    };
  }, [open, tweetId, permalink]);

  async function onSave() {
    if (!tweetId || !permalink) {
      setError("Open a tweet first, then tap Bookmark.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const enriched = await enrichTweetFromId(tweetId, permalink);
      await saveBookmark(appwrite, {
        ...enriched,
        folder_ids: selected,
      });
      onSaved(selected[0] ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setBusy(false);
    }
  }

  function toggle(id: string) {
    setSelected((cur) =>
      cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id],
    );
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle sx={{ color: "primary.light" }}>Save to folder</DialogTitle>
      <DialogContent>
        <Stack spacing={1.5} sx={{ pt: 0.5 }}>
          {!tweetId ? (
            <Alert severity="warning">
              Open a tweet (status page), then tap the bookmark icon in the
              toolbar.
            </Alert>
          ) : preview ? (
            <Typography variant="body2" color="text.secondary">
              {preview}
            </Typography>
          ) : (
            <Box sx={{ display: "flex", justifyContent: "center", py: 1 }}>
              <CircularProgress size={22} />
            </Box>
          )}

          {loading ? (
            <CircularProgress size={22} />
          ) : folders.length === 0 ? (
            <Alert severity="info">
              Create a folder under Folders first, then save again.
            </Alert>
          ) : (
            folders.map((f) => (
              <FormControlLabel
                key={f.id}
                control={
                  <Checkbox
                    checked={selected.includes(f.id)}
                    onChange={() => toggle(f.id)}
                    sx={{
                      color: FOLDER_COLOR_HEX[f.color],
                      "&.Mui-checked": { color: FOLDER_COLOR_HEX[f.color] },
                    }}
                  />
                }
                label={f.name}
              />
            ))
          )}

          {error ? <Alert severity="error">{error}</Alert> : null}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={busy}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={() => void onSave()}
          disabled={busy || !tweetId || selected.length === 0}
        >
          {busy ? "Saving…" : "Save"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
