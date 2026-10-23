import { useState } from "react";
import {
  FOLDER_COLORS,
  FOLDER_COLOR_HEX,
  type Folder,
  type FolderColor,
} from "@xbookmarks/shared";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";

interface Props {
  initial?: Folder | null;
  onClose: () => void;
  onSubmit: (input: { name: string; color: FolderColor }) => Promise<void>;
}

export function FolderFormModal({ initial, onClose, onSubmit }: Props) {
  const [name, setName] = useState(initial?.name ?? "");
  const [color, setColor] = useState<FolderColor>(initial?.color ?? "sky");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError("Name is required");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onSubmit({ name: name.trim(), color });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save folder");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="xs">
      <form onSubmit={handleSubmit}>
        <DialogTitle>{initial ? "Edit folder" : "New folder"}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <TextField
              autoFocus
              fullWidth
              label="Folder name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <Stack direction="row" sx={{ flexWrap: "wrap", gap: 1 }}>
              {FOLDER_COLORS.map((c) => (
                <Box
                  key={c}
                  component="button"
                  type="button"
                  aria-label={c}
                  onClick={() => setColor(c)}
                  sx={{
                    width: 28,
                    height: 28,
                    borderRadius: "50%",
                    bgcolor: FOLDER_COLOR_HEX[c],
                    border:
                      color === c
                        ? "2px solid #f5c518"
                        : "2px solid transparent",
                    cursor: "pointer",
                    p: 0,
                  }}
                />
              ))}
            </Stack>
            {error ? <Alert severity="error">{error}</Alert> : null}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={onClose} color="inherit">
            Cancel
          </Button>
          <Button type="submit" variant="contained" disabled={busy}>
            {busy ? "Saving…" : "Save"}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
