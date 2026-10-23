import { useEffect, useState } from "react";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Link from "@mui/material/Link";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import {
  likelyNonEnglish,
  translateToEnglish,
} from "../lib/translate";

interface Props {
  text: string;
}

/**
 * Shows English translation for non-English posts (X-style auto-translate).
 * Original remains available via toggle.
 */
export function TweetText({ text }: Props) {
  const trimmed = text.trim();
  const [translated, setTranslated] = useState<string | null>(null);
  const [showOriginal, setShowOriginal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isEnglish, setIsEnglish] = useState(!likelyNonEnglish(trimmed));

  useEffect(() => {
    let cancelled = false;
    if (!trimmed) {
      setTranslated(null);
      setIsEnglish(true);
      return;
    }

    // Latin-only posts: don't auto-hit the API (likely English).
    // Non-Latin scripts (CJK, Arabic, etc.) always auto-translate to English.
    if (!likelyNonEnglish(trimmed)) {
      setTranslated(null);
      setIsEnglish(true);
      setLoading(false);
      return;
    }

    setLoading(true);
    void translateToEnglish(trimmed).then((result) => {
      if (cancelled) return;
      setIsEnglish(result.isEnglish);
      setTranslated(result.isEnglish ? null : result.translated);
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [trimmed]);

  if (!trimmed) {
    return (
      <Typography sx={{ mt: 1.5, color: "#9a9590" }} variant="body2">
        No text — tap ↻ to fetch the full post.
      </Typography>
    );
  }

  const bodySx = {
    mt: 1.5,
    mb: 0,
    whiteSpace: "pre-wrap" as const,
    wordBreak: "break-word" as const,
    overflowWrap: "anywhere" as const,
    fontSize: "1.05rem",
    lineHeight: 1.5,
    color: "#e8e6e3",
  };

  const display =
    !isEnglish && translated && !showOriginal ? translated : trimmed;

  return (
    <Stack spacing={0.75} sx={{ mt: 0.5 }}>
      <Stack direction="row" spacing={1} sx={{ alignItems: "center", mt: 1 }}>
        {loading ? (
          <>
            <CircularProgress size={14} color="primary" />
            <Typography variant="caption" sx={{ color: "#9a9590" }}>
              Translating…
            </Typography>
          </>
        ) : null}
        {!loading && !isEnglish && translated ? (
          <Chip
            size="small"
            variant="outlined"
            label="Translated to English"
            sx={{
              borderColor: "rgba(212,160,23,0.5)",
              color: "#f5c518",
              height: 22,
              fontSize: "0.7rem",
            }}
          />
        ) : null}
      </Stack>

      <Typography component="p" className="tweet-body" sx={bodySx}>
        {display}
      </Typography>

      {!loading && !isEnglish && translated ? (
        <Link
          component="button"
          type="button"
          variant="caption"
          underline="hover"
          onClick={() => setShowOriginal((v) => !v)}
          sx={{ color: "#f5c518", alignSelf: "flex-start" }}
        >
          {showOriginal ? "Show translation" : "Show original"}
        </Link>
      ) : null}
    </Stack>
  );
}
