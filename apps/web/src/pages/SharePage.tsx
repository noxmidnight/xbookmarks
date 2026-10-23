import { useEffect, useMemo, useState } from "react";
import { Link as RouterLink, useNavigate, useSearchParams } from "react-router-dom";
import {
  extractTweetIdFromUrl,
  enrichTweetFromId,
  FOLDER_COLOR_HEX,
  saveBookmark,
  urlsToMediaItems,
} from "@xbookmarks/shared";
import { useFolders } from "../hooks/useLibrary";
import { appwrite } from "../lib/appwrite";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Checkbox from "@mui/material/Checkbox";
import CircularProgress from "@mui/material/CircularProgress";
import FormControlLabel from "@mui/material/FormControlLabel";
import Link from "@mui/material/Link";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";

function pickUrl(params: URLSearchParams): string | null {
  const candidates = [params.get("url"), params.get("text"), params.get("title")];
  for (const value of candidates) {
    if (!value) continue;
    const match = value.match(/https?:\/\/(?:x|twitter)\.com\/\S+/i);
    if (match) return match[0].replace(/[),.]+$/, "");
    if (/^https?:\/\//i.test(value) && extractTweetIdFromUrl(value)) return value;
  }
  return null;
}

export function SharePage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const sharedUrl = useMemo(() => pickUrl(params), [params]);
  const tweetId = sharedUrl ? extractTweetIdFromUrl(sharedUrl) : null;
  const { folders, loading } = useFolders();
  const [selected, setSelected] = useState<string[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [previewText, setPreviewText] = useState<string | null>(null);
  const [previewAuthor, setPreviewAuthor] = useState<string | null>(null);
  const [previewMedia, setPreviewMedia] = useState<string[]>([]);
  const [enriching, setEnriching] = useState(false);

  useEffect(() => {
    if (folders.length && selected.length === 0) {
      setSelected([folders[0]!.id]);
    }
  }, [folders, selected.length]);

  useEffect(() => {
    if (!tweetId) return;
    let cancelled = false;
    setEnriching(true);
    void enrichTweetFromId(tweetId, sharedUrl || undefined).then((tweet) => {
      if (cancelled) return;
      setPreviewText(tweet.text || null);
      setPreviewAuthor(
        tweet.author_handle !== "unknown"
          ? `${tweet.author_name} @${tweet.author_handle}`
          : null,
      );
      setPreviewMedia(tweet.media_urls);
      setEnriching(false);
    });
    return () => {
      cancelled = true;
    };
  }, [tweetId, sharedUrl]);

  async function onSave() {
    if (!sharedUrl || !tweetId) {
      setError("No X post URL found in the shared content.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const enriched = await enrichTweetFromId(tweetId, sharedUrl);
      // Android share payload is often just the URL — never prefer that over enrichment
      const rawShare = [params.get("title"), params.get("text")]
        .filter(Boolean)
        .join("\n");
      const shareFallback = rawShare
        .replace(/https?:\/\/(?:x|twitter)\.com\/\S+/gi, "")
        .trim();
      const text =
        enriched.text.trim() ||
        shareFallback ||
        "";
      await saveBookmark(appwrite, {
        ...enriched,
        text,
        folder_ids: selected,
      });
      setStatus("Saved to XBookmarks.");
      setTimeout(
        () => navigate(selected[0] ? `/folder/${selected[0]}` : "/all"),
        700,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Box sx={{ py: 2 }}>
        <Link component={RouterLink} to="/" underline="hover" color="primary">
          ← Folders
        </Link>
        <Typography variant="h5" sx={{ mt: 1, color: "primary.light" }}>
          Save shared post
        </Typography>
      </Box>

      <Card>
        <CardContent>
          <Stack spacing={2}>
            <Typography color="text.secondary" variant="body2">
              Android Share Target / pasted X link
            </Typography>
            <Typography
              component="code"
              sx={{
                wordBreak: "break-all",
                fontSize: "0.85rem",
                color: "primary.light",
              }}
            >
              {sharedUrl ?? "No URL detected"}
            </Typography>

            {enriching ? (
              <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                <CircularProgress size={18} color="primary" />
                <Typography variant="body2" color="text.secondary">
                  Fetching post & media…
                </Typography>
              </Stack>
            ) : null}

            {previewAuthor ? (
              <Typography sx={{ fontWeight: 700 }}>{previewAuthor}</Typography>
            ) : null}
            {previewText ? (
              <Typography sx={{ whiteSpace: "pre-wrap" }}>{previewText}</Typography>
            ) : null}
            {previewMedia.length > 0
              ? urlsToMediaItems(previewMedia).slice(0, 1).map((item) =>
                  item.kind === "video" || item.kind === "gif" ? (
                    <Box
                      key={item.url}
                      component="video"
                      src={item.url}
                      controls
                      playsInline
                      sx={{
                        width: "100%",
                        maxHeight: 320,
                        borderRadius: 2,
                        border: "1px solid",
                        borderColor: "divider",
                        bgcolor: "#000",
                      }}
                    />
                  ) : (
                    <Box
                      key={item.url}
                      component="img"
                      src={item.url}
                      alt=""
                      referrerPolicy="no-referrer"
                      sx={{
                        width: "100%",
                        maxHeight: 320,
                        objectFit: "contain",
                        borderRadius: 2,
                        border: "1px solid",
                        borderColor: "divider",
                        bgcolor: "#000",
                      }}
                    />
                  ),
                )
              : null}

            {loading ? (
              <Typography color="text.secondary">Loading folders…</Typography>
            ) : null}

            <Stack>
              {folders.map((folder) => {
                const checked = selected.includes(folder.id);
                return (
                  <FormControlLabel
                    key={folder.id}
                    control={
                      <Checkbox
                        checked={checked}
                        onChange={(e) => {
                          setSelected((prev) =>
                            e.target.checked
                              ? [...prev, folder.id]
                              : prev.filter((id) => id !== folder.id),
                          );
                        }}
                        sx={{ color: "primary.main" }}
                      />
                    }
                    label={
                      <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
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
                );
              })}
            </Stack>

            {error ? <Alert severity="error">{error}</Alert> : null}
            {status ? <Alert severity="success">{status}</Alert> : null}

            <Button
              variant="contained"
              disabled={busy || !tweetId}
              onClick={() => void onSave()}
            >
              {busy ? "Saving…" : "Save bookmark"}
            </Button>
          </Stack>
        </CardContent>
      </Card>
    </>
  );
}
