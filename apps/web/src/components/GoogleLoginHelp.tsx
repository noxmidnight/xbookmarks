import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import {
  openXGoogleLoginInBrave,
  openXPasswordSettingsInBrave,
} from "../lib/xGoogleLogin";
import { showXFeed } from "../lib/xFeed";

type Props = {
  open: boolean;
  onClose: () => void;
};

/**
 * Google-only X accounts: sign in with Google in Brave, set an X password,
 * then use username + password in the in-app Feed WebView.
 */
export function GoogleLoginHelp({ open, onClose }: Props) {
  if (!open) return null;

  return (
    <Box
      sx={{
        position: "fixed",
        inset: 0,
        zIndex: 40,
        bgcolor: "rgba(0,0,0,0.72)",
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
        p: 2,
        pb: "calc(72px + env(safe-area-inset-bottom, 0px))",
      }}
    >
      <Paper sx={{ width: "100%", maxWidth: 480, p: 2.5 }}>
        <Stack spacing={1.5}>
          <Typography variant="h6" sx={{ color: "primary.light" }}>
            Sign in with Google
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Google blocks Sign-In inside the app. If your X account only works
            with Google, do this once:
          </Typography>
          <Alert severity="info" sx={{ py: 0.5 }}>
            <Typography variant="body2" component="div">
              <strong>1.</strong> Sign in with Google in Brave
              <br />
              <strong>2.</strong> In Brave, set an X password (Settings →
              Password)
              <br />
              <strong>3.</strong> Come back here → sign in with your{" "}
              <strong>@username + that password</strong>
            </Typography>
          </Alert>
          <Button
            variant="contained"
            onClick={() => {
              void openXGoogleLoginInBrave();
            }}
          >
            1 · Open Google login in Brave
          </Button>
          <Button
            variant="outlined"
            onClick={() => {
              void openXPasswordSettingsInBrave();
            }}
          >
            2 · Set X password in Brave
          </Button>
          <Button
            variant="contained"
            color="inherit"
            onClick={() => {
              onClose();
              void showXFeed();
            }}
          >
            3 · Back to Feed — use username &amp; password
          </Button>
          <Button size="small" onClick={onClose}>
            Dismiss
          </Button>
        </Stack>
      </Paper>
    </Box>
  );
}
