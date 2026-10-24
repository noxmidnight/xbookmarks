import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { OWNER_EMAIL } from "../lib/owner";
import { isNativeApp, resetFeedLogin } from "../lib/xFeed";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";

export function SettingsPage() {
  const navigate = useNavigate();
  const { user, signOut, createExtensionJwt } = useAuth();
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState<string | null>(null);
  const [feedBusy, setFeedBusy] = useState(false);
  const [feedMsg, setFeedMsg] = useState<string | null>(null);

  async function copyJwtForExtension() {
    setCopyError(null);
    try {
      const jwt = await createExtensionJwt();
      await navigator.clipboard.writeText(JSON.stringify({ jwt }));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      setCopyError(err instanceof Error ? err.message : "Could not create JWT");
    }
  }

  return (
    <>
      <Box sx={{ py: 2 }}>
        <Typography variant="h5" sx={{ color: "primary.light" }}>
          Settings
        </Typography>
        <Typography color="text.secondary" variant="body2">
          Account & install
        </Typography>
      </Box>

      <Stack spacing={1.5}>
        <Card>
          <CardContent>
            <Stack spacing={1.5}>
              <Typography sx={{ fontWeight: 700 }}>Account</Typography>
              <Typography color="text.secondary">{user?.email}</Typography>
              <Typography variant="caption" color="text.secondary">
                Private access locked to {OWNER_EMAIL}
              </Typography>
              <Button
                variant="outlined"
                onClick={() => void copyJwtForExtension()}
              >
                {copied ? "Copied!" : "Copy JWT for extension"}
              </Button>
              {copyError ? <Alert severity="error">{copyError}</Alert> : null}
              <Button variant="outlined" color="inherit" onClick={() => signOut()}>
                Sign out
              </Button>
            </Stack>
          </CardContent>
        </Card>

        {isNativeApp() ? (
          <Card>
            <CardContent>
              <Stack spacing={1.5}>
                <Typography sx={{ fontWeight: 700 }}>X Feed login</Typography>
                <Typography color="text.secondary" variant="body2">
                  Google blocks “Sign in with Google” inside apps (that “clear
                  Chrome cookies” page). Use <strong>username &amp; password</strong>{" "}
                  or <strong>Apple</strong> on X’s login screen instead. Clearing
                  Chrome does not fix this.
                </Typography>
                <Button
                  variant="contained"
                  disabled={feedBusy}
                  onClick={() => {
                    void (async () => {
                      setFeedBusy(true);
                      setFeedMsg(null);
                      try {
                        await resetFeedLogin();
                        setFeedMsg("Feed cookies cleared — opening X login.");
                        navigate("/feed");
                      } catch (err) {
                        setFeedMsg(
                          err instanceof Error
                            ? err.message
                            : "Could not reset Feed login",
                        );
                      } finally {
                        setFeedBusy(false);
                      }
                    })();
                  }}
                >
                  {feedBusy ? "Working…" : "Reset Feed login"}
                </Button>
                {feedMsg ? <Alert severity="info">{feedMsg}</Alert> : null}
              </Stack>
            </CardContent>
          </Card>
        ) : null}

        <Card>
          <CardContent>
            <Stack spacing={1}>
              <Typography sx={{ fontWeight: 700 }}>Install as app (PWA)</Typography>
              <Typography color="text.secondary" variant="body2">
                On Android Brave/Chrome: open this site → menu →{" "}
                <strong>Install app</strong> / Add to Home screen. Then use Share
                → XBookmarks from X.
              </Typography>
            </Stack>
          </CardContent>
        </Card>
      </Stack>
    </>
  );
}
