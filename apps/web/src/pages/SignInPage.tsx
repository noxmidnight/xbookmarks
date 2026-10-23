import { useState } from "react";
import { Navigate } from "react-router-dom";
import { Capacitor } from "@capacitor/core";
import { useAuth } from "../lib/auth";
import { OWNER_EMAIL } from "../lib/owner";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";

export function SignInPage() {
  const {
    user,
    loading,
    configured,
    signInWithMagicLink,
    requestEmailOtp,
    verifyEmailOtp,
  } = useAuth();
  const native = Capacitor.isNativePlatform();
  const [email, setEmail] = useState(OWNER_EMAIL);
  const [otp, setOtp] = useState("");
  const [otpUserId, setOtpUserId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!loading && user) {
    return <Navigate to={native ? "/feed" : "/"} replace />;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);

    if (native) {
      if (otpUserId && otp.trim()) {
        const result = await verifyEmailOtp(otpUserId, otp);
        setBusy(false);
        if (result.error) setError(result.error);
        return;
      }
      const result = await requestEmailOtp(email);
      setBusy(false);
      if (result.error) {
        setError(result.error);
        return;
      }
      setOtpUserId(result.userId);
      setMessage("Check your email for a 6-digit code.");
      return;
    }

    const result = await signInWithMagicLink(email);
    setBusy(false);
    if (result.error) setError(result.error);
    else setMessage("Check your email for the magic link.");
  }

  return (
    <Box
      sx={{
        minHeight: "100dvh",
        display: "grid",
        placeItems: "center",
        px: 2,
        background:
          "radial-gradient(ellipse at top, rgba(212,160,23,0.12), transparent 55%), #0a0a0a",
      }}
    >
      <Card sx={{ width: "100%", maxWidth: 420 }}>
        <CardContent>
          <Stack spacing={2}>
            <Typography variant="h4" component="h1">
              X
              <Box component="span" sx={{ color: "primary.light" }}>
                Bookmarks
              </Box>
            </Typography>
            <Typography color="text.secondary">
              {native
                ? "Private Android app — email a one-time code to sign in."
                : "Private library — magic-link sign-in for the owner only."}
            </Typography>
            {!configured ? (
              <Alert severity="error">Appwrite env vars are missing.</Alert>
            ) : (
              <Box component="form" onSubmit={onSubmit}>
                <Stack spacing={2}>
                  <TextField
                    type="email"
                    required
                    fullWidth
                    label="Email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="email"
                    disabled={Boolean(native && otpUserId)}
                  />
                  {native && otpUserId ? (
                    <TextField
                      type="text"
                      required
                      fullWidth
                      label="6-digit code"
                      value={otp}
                      onChange={(e) => setOtp(e.target.value)}
                      slotProps={{
                        htmlInput: {
                          inputMode: "numeric",
                          autoComplete: "one-time-code",
                        },
                      }}
                    />
                  ) : null}
                  <Button
                    type="submit"
                    variant="contained"
                    fullWidth
                    disabled={busy}
                  >
                    {busy
                      ? "Please wait…"
                      : native && otpUserId
                        ? "Verify code"
                        : native
                          ? "Email me a code"
                          : "Email magic link"}
                  </Button>
                  {native && otpUserId ? (
                    <Button
                      type="button"
                      onClick={() => {
                        setOtpUserId(null);
                        setOtp("");
                        setMessage(null);
                      }}
                    >
                      Use a different email
                    </Button>
                  ) : null}
                </Stack>
              </Box>
            )}
            {message ? <Alert severity="success">{message}</Alert> : null}
            {error ? <Alert severity="error">{error}</Alert> : null}
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
}
