import { useDeferredValue, useState } from "react";
import { BookmarkList } from "../components/BookmarkList";
import { useBookmarks, useFolders } from "../hooks/useLibrary";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";

export function SearchPage() {
  const [query, setQuery] = useState("");
  const deferred = useDeferredValue(query.trim());
  const { folders } = useFolders();
  const { bookmarks, loading, error, refresh } = useBookmarks({
    query: deferred || undefined,
  });

  return (
    <>
      <Box sx={{ py: 2 }}>
        <Typography variant="h5" sx={{ color: "primary.light" }}>
          Search
        </Typography>
        <Typography color="text.secondary" variant="body2">
          Text, author, or URL
        </Typography>
      </Box>
      <TextField
        fullWidth
        placeholder="Search bookmarks…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        sx={{ mb: 2 }}
      />
      {!deferred ? (
        <Card>
          <CardContent>
            <Typography color="text.secondary">
              Type to search your saved posts.
            </Typography>
          </CardContent>
        </Card>
      ) : (
        <>
          {loading ? (
            <Typography color="text.secondary">Searching…</Typography>
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
      )}
    </>
  );
}
