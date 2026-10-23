import { useState } from "react";
import { Link as RouterLink } from "react-router-dom";
import {
  createFolder,
  deleteFolder,
  FOLDER_COLOR_HEX,
  updateFolder,
  type FolderColor,
} from "@xbookmarks/shared";
import { FolderFormModal } from "../components/FolderFormModal";
import { useFolders } from "../hooks/useLibrary";
import { appwrite } from "../lib/appwrite";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardActionArea from "@mui/material/CardActionArea";
import CardContent from "@mui/material/CardContent";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";

export function FoldersPage() {
  const { folders, counts, loading, error, refresh } = useFolders();
  const [showCreate, setShowCreate] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

  const editing = folders.find((f) => f.id === editId) ?? null;

  return (
    <>
      <Stack
        direction="row"
        sx={{
          justifyContent: "space-between",
          alignItems: "center",
          py: 2,
        }}
      >
        <Box>
          <Typography variant="h5" sx={{ color: "primary.light" }}>
            XBookmarks
          </Typography>
          <Typography color="text.secondary" variant="body2">
            Your folders
          </Typography>
        </Box>
        <Button variant="contained" onClick={() => setShowCreate(true)}>
          New
        </Button>
      </Stack>

      <Stack spacing={1.25} sx={{ mb: 2 }}>
        <Card>
          <CardActionArea component={RouterLink} to="/all">
            <CardContent>
              <Typography sx={{ fontWeight: 700 }}>All Bookmarks</Typography>
              <Typography color="text.secondary" variant="body2">
                Everything you have saved
              </Typography>
            </CardContent>
          </CardActionArea>
        </Card>
        <Card>
          <CardActionArea component={RouterLink} to="/folder/uncategorized">
            <CardContent>
              <Typography sx={{ fontWeight: 700 }}>Uncategorized</Typography>
              <Typography color="text.secondary" variant="body2">
                Not in any folder yet
              </Typography>
            </CardContent>
          </CardActionArea>
        </Card>
      </Stack>

      {loading ? (
        <Typography color="text.secondary">Loading folders…</Typography>
      ) : null}
      {error ? <Alert severity="error">{error}</Alert> : null}

      <Stack spacing={1.25}>
        {folders.map((folder) => (
          <Card key={folder.id}>
            <CardContent>
              <Stack
                direction="row"
                spacing={1}
                component={RouterLink}
                to={`/folder/${folder.id}`}
                sx={{
                  alignItems: "center",
                  textDecoration: "none",
                  color: "inherit",
                }}
              >
                <Box
                  sx={{
                    width: 12,
                    height: 12,
                    borderRadius: "50%",
                    bgcolor: FOLDER_COLOR_HEX[folder.color],
                  }}
                />
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography sx={{ fontWeight: 700 }}>{folder.name}</Typography>
                  <Typography color="text.secondary" variant="body2">
                    {counts[folder.id] ?? 0} bookmark
                    {(counts[folder.id] ?? 0) === 1 ? "" : "s"}
                  </Typography>
                </Box>
              </Stack>
              <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                <Button size="small" onClick={() => setEditId(folder.id)}>
                  Edit
                </Button>
                <Button
                  size="small"
                  color="error"
                  onClick={async () => {
                    if (
                      !confirm(
                        `Delete “${folder.name}”? Bookmarks stay; they become uncategorized.`,
                      )
                    ) {
                      return;
                    }
                    await deleteFolder(appwrite, folder.id);
                    await refresh();
                  }}
                >
                  Delete
                </Button>
              </Stack>
            </CardContent>
          </Card>
        ))}
      </Stack>

      {!loading && folders.length === 0 ? (
        <Card sx={{ mt: 2 }}>
          <CardContent>
            <Typography color="text.secondary">
              Create your first folder to organize bookmarks like X Premium.
            </Typography>
          </CardContent>
        </Card>
      ) : null}

      {showCreate ? (
        <FolderFormModal
          onClose={() => setShowCreate(false)}
          onSubmit={async ({ name, color }) => {
            await createFolder(appwrite, { name, color });
            await refresh();
          }}
        />
      ) : null}

      {editing ? (
        <FolderFormModal
          initial={editing}
          onClose={() => setEditId(null)}
          onSubmit={async ({
            name,
            color,
          }: {
            name: string;
            color: FolderColor;
          }) => {
            await updateFolder(appwrite, editing.id, { name, color });
            await refresh();
          }}
        />
      ) : null}
    </>
  );
}
