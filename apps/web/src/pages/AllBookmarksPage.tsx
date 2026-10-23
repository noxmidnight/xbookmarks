import { Link as RouterLink } from "react-router-dom";
import { BookmarkList } from "../components/BookmarkList";
import { useBookmarks, useFolders } from "../hooks/useLibrary";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Link from "@mui/material/Link";
import Typography from "@mui/material/Typography";

export function AllBookmarksPage() {
  const { folders } = useFolders();
  const { bookmarks, loading, error, refresh } = useBookmarks();

  return (
    <>
      <Box sx={{ py: 2 }}>
        <Link component={RouterLink} to="/" underline="hover" color="primary">
          ← Folders
        </Link>
        <Typography variant="h5" sx={{ mt: 1, color: "primary.light" }}>
          All Bookmarks
        </Typography>
      </Box>
      {loading ? (
        <Typography color="text.secondary">Loading…</Typography>
      ) : null}
      {error ? <Alert severity="error">{error}</Alert> : null}
      {!loading ? (
        <BookmarkList
          bookmarks={bookmarks}
          folders={folders}
          onChanged={refresh}
        />
      ) : null}
    </>
  );
}
