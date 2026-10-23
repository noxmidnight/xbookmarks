import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { ID, type Models } from "appwrite";
import { appwrite, isAppwriteConfigured } from "./appwrite";
import { isOwnerEmail, OWNER_EMAIL } from "./owner";

interface AuthContextValue {
  user: Models.User<Models.Preferences> | null;
  loading: boolean;
  configured: boolean;
  signInWithMagicLink: (email: string) => Promise<{ error: string | null }>;
  /** Email OTP for Capacitor (magic links can't return into the app WebView). */
  requestEmailOtp: (
    email: string,
  ) => Promise<{ error: string | null; userId: string | null }>;
  verifyEmailOtp: (
    userId: string,
    secret: string,
  ) => Promise<{ error: string | null }>;
  completeMagicLink: (
    userId: string,
    secret: string,
  ) => Promise<{ error: string | null }>;
  createExtensionJwt: () => Promise<string>;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

async function enforceOwnerOrSignOut(
  next: Models.User<Models.Preferences>,
): Promise<Models.User<Models.Preferences> | null> {
  if (isOwnerEmail(next.email)) return next;
  try {
    await appwrite.account.deleteSession("current");
  } catch {
    // ignore
  }
  return null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Models.User<Models.Preferences> | null>(
    null,
  );
  const [loading, setLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    if (!isAppwriteConfigured) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const next = await appwrite.account.get();
      setUser(await enforceOwnerOrSignOut(next));
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshUser();
  }, [refreshUser]);

  useEffect(() => {
    if (!isAppwriteConfigured) return;
    const params = new URLSearchParams(window.location.search);
    const hashParams = new URLSearchParams(
      window.location.hash.split("?")[1] || "",
    );
    const userId = params.get("userId") || hashParams.get("userId");
    const secret = params.get("secret") || hashParams.get("secret");
    if (!userId || !secret) return;

    void (async () => {
      try {
        await appwrite.account.updateMagicURLSession(userId, secret);
        window.history.replaceState({}, "", window.location.pathname);
        await refreshUser();
      } catch (err) {
        console.error("Magic link completion failed", err);
      }
    })();
  }, [refreshUser]);

  const signInWithMagicLink = useCallback(async (email: string) => {
    if (!isAppwriteConfigured) {
      return { error: "Appwrite is not configured. Add env vars first." };
    }
    if (!isOwnerEmail(email)) {
      return {
        error: `Private app — only ${OWNER_EMAIL} can sign in.`,
      };
    }
    try {
      await appwrite.account.createMagicURLToken(
        ID.unique(),
        email.trim(),
        window.location.origin,
      );
      return { error: null };
    } catch (err) {
      return {
        error: err instanceof Error ? err.message : "Failed to send magic link",
      };
    }
  }, []);

  const requestEmailOtp = useCallback(async (email: string) => {
    if (!isAppwriteConfigured) {
      return {
        error: "Appwrite is not configured. Add env vars first.",
        userId: null,
      };
    }
    if (!isOwnerEmail(email)) {
      return {
        error: `Private app — only ${OWNER_EMAIL} can sign in.`,
        userId: null,
      };
    }
    try {
      const token = await appwrite.account.createEmailToken(
        ID.unique(),
        email.trim(),
      );
      return { error: null, userId: token.userId };
    } catch (err) {
      return {
        error: err instanceof Error ? err.message : "Failed to send code",
        userId: null,
      };
    }
  }, []);

  const verifyEmailOtp = useCallback(
    async (userId: string, secret: string) => {
      try {
        await appwrite.account.createSession(userId, secret.trim());
        await refreshUser();
        return { error: null };
      } catch (err) {
        return {
          error: err instanceof Error ? err.message : "Invalid or expired code",
        };
      }
    },
    [refreshUser],
  );

  const completeMagicLink = useCallback(
    async (userId: string, secret: string) => {
      try {
        await appwrite.account.updateMagicURLSession(userId, secret);
        await refreshUser();
        return { error: null };
      } catch (err) {
        return {
          error:
            err instanceof Error ? err.message : "Failed to complete sign-in",
        };
      }
    },
    [refreshUser],
  );

  const createExtensionJwt = useCallback(async () => {
    const result = await appwrite.account.createJWT();
    return result.jwt;
  }, []);

  const signOut = useCallback(async () => {
    try {
      await appwrite.account.deleteSession("current");
    } catch {
      // ignore
    }
    setUser(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      configured: isAppwriteConfigured,
      signInWithMagicLink,
      requestEmailOtp,
      verifyEmailOtp,
      completeMagicLink,
      createExtensionJwt,
      signOut,
      refreshUser,
    }),
    [
      user,
      loading,
      signInWithMagicLink,
      requestEmailOtp,
      verifyEmailOtp,
      completeMagicLink,
      createExtensionJwt,
      signOut,
      refreshUser,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
