import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { isBraveInstalled } from "../lib/braveBrowser";
import { OWNER_EMAIL } from "../lib/owner";
import { isNativeApp, resetFeedLogin } from "../lib/xFeed";
import {
  openXGoogleLoginInBrave,
  openXPasswordSettingsInBrave,
} from "../lib/xGoogleLogin";
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
  const [braveOk, setBraveOk] = useState<boolean | null>(null);

  useEffect(() => {
    if (!isNativeApp()) return;
    void isBraveInstalled().then(setBraveOk);
  }, []);

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
                <Typography sx={{ fontWeight: 700 }}>
                  X login (Google-only accounts)
                </Typography>
                <Typography color="text.secondary" variant="body2">
                  If you can only sign into X with Google: Android blocks that
                  inside the app. Sign in with Google in <strong>Brave</strong>,
                  set an <strong>X password</strong> once, then use{" "}
                  <strong>@username + password</strong> in the Feed.
                </Typography>
                <Typography color="text.secondary" variant="body2">
                  Brave:{" "}
                  {braveOk === null
                    ? "…"
                    : braveOk
                      ? "installed"
                      : "not installed — install Brave first"}
                </Typography>
                <Button
                  variant="contained"
                  disabled={feedBusy}
                  onClick={() => {
                    void (async () => {
                      setFeedBusy(true);
                      setFeedMsg(null);
                      const result = await openXGoogleLoginInBrave();
                      setFeedMsg(
                        result.brave
                          ? "Brave opened — tap Sign in with Google there."
                          : result.opened
                            ? "Browser opened — use Google sign-in there."
                            : "Could not open a browser. Install Brave.",
                      );
                      setFeedBusy(false);
                    })();
                  }}
                >
                  Sign in with Google in Brave
                </Button>
                <Button
                  variant="outlined"
                  disabled={feedBusy}
                  onClick={() => {
                    void (async () => {
                      setFeedBusy(true);
                      setFeedMsg(null);
                      const result = await openXPasswordSettingsInBrave();
                      setFeedMsg(
                        result.opened
                          ? "Set a password for your X account, then return to Feed."
                          : "Could not open password settings.",
                      );
                      setFeedBusy(false);
                    })();
                  }}
                >
                  Set X password in Brave
                </Button>
                <Button
                  variant="outlined"
                  disabled={feedBusy}
                  onClick={() => {
                    void (async () => {
                      setFeedBusy(true);
                      setFeedMsg(null);
                      try {
                        await resetFeedLogin();
                        setFeedMsg(
                          "Feed ready — sign in with @username + the password you set.",
                        );
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
                  Open Feed login
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
