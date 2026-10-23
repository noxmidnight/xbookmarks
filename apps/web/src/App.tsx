import { Navigate, Route, Routes } from "react-router-dom";
import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import Typography from "@mui/material/Typography";
import { useAuth } from "./lib/auth";
import { Shell } from "./components/Shell";
import { SignInPage } from "./pages/SignInPage";
import { FoldersPage } from "./pages/FoldersPage";
import { FolderDetailPage } from "./pages/FolderDetailPage";
import { SearchPage } from "./pages/SearchPage";
import { SettingsPage } from "./pages/SettingsPage";
import { SharePage } from "./pages/SharePage";
import { AllBookmarksPage } from "./pages/AllBookmarksPage";
import { FeedPage } from "./pages/FeedPage";

function Protected({ children }: { children: React.ReactNode }) {
  const { user, loading, configured } = useAuth();

  if (loading) {
    return (
      <Box
        sx={{
          minHeight: "100dvh",
          display: "grid",
          placeItems: "center",
        }}
      >
        <CircularProgress color="primary" />
      </Box>
    );
  }

  if (!configured) {
    return (
      <Box sx={{ p: 3, maxWidth: 480, mx: "auto" }}>
        <Typography variant="h5" sx={{ color: "primary.light", mb: 1 }}>
          XBookmarks
        </Typography>
        <Typography color="text.secondary">
          Configure <code>VITE_APPWRITE_ENDPOINT</code> and{" "}
          <code>VITE_APPWRITE_PROJECT_ID</code> before building.
        </Typography>
      </Box>
    );
  }

  if (!user) return <Navigate to="/signin" replace />;
  return <>{children}</>;
}

export function App() {
  return (
    <Routes>
      <Route path="/signin" element={<SignInPage />} />
      <Route
        path="/"
        element={
          <Protected>
            <Shell />
          </Protected>
        }
      >
        <Route index element={<FoldersPage />} />
        <Route path="feed" element={<FeedPage />} />
        <Route path="all" element={<AllBookmarksPage />} />
        <Route path="folder/:folderId" element={<FolderDetailPage />} />
        <Route path="search" element={<SearchPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="share" element={<SharePage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
