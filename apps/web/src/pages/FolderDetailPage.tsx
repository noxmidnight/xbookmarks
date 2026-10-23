import { Link as RouterLink, useParams } from "react-router-dom";
import { FOLDER_COLOR_HEX } from "@xbookmarks/shared";
import { BookmarkList } from "../components/BookmarkList";
import { useBookmarks, useFolders } from "../hooks/useLibrary";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Link from "@mui/material/Link";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";

export function FolderDetailPage() {
  const { folderId } = useParams();
  const isUncategorized = folderId === "uncategorized";
  const { folders, loading: foldersLoading } = useFolders();
  const folder = isUncategorized
    ? null
    : (folders.find((f) => f.id === folderId) ?? null);

  const { bookmarks, loading, error, refresh } = useBookmarks({
    folderId: isUncategorized ? null : folderId,
  });

  const title = isUncategorized
    ? "Uncategorized"
    : (folder?.name ?? (foldersLoading ? "…" : "Folder"));

  return (
    <>
      <Box sx={{ py: 2 }}>
        <Link component={RouterLink} to="/" underline="hover" color="primary">
          ← Folders
        </Link>
        <Stack direction="row" spacing={1} sx={{ alignItems: "center", mt: 1 }}>
          {folder ? (
            <Box
              sx={{
                width: 12,
                height: 12,
                borderRadius: "50%",
                bgcolor: FOLDER_COLOR_HEX[folder.color],
              }}
            />
          ) : null}
          <Typography variant="h5" sx={{ color: "primary.light" }}>
            {title}
          </Typography>
        </Stack>
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
