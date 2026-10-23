import { Outlet, useLocation, useNavigate } from "react-router-dom";
import BottomNavigation from "@mui/material/BottomNavigation";
import BottomNavigationAction from "@mui/material/BottomNavigationAction";
import Paper from "@mui/material/Paper";
import DynamicFeedOutlinedIcon from "@mui/icons-material/DynamicFeedOutlined";
import FolderOutlinedIcon from "@mui/icons-material/FolderOutlined";
import ViewListOutlinedIcon from "@mui/icons-material/ViewListOutlined";
import SearchOutlinedIcon from "@mui/icons-material/SearchOutlined";
import SettingsOutlinedIcon from "@mui/icons-material/SettingsOutlined";
import {
  hideXFeed,
  isFeedUiSuspended,
  isNativeApp,
  setFeedRouteActive,
  showXFeed,
} from "../lib/xFeed";
import { useEffect } from "react";
import { App as CapApp } from "@capacitor/app";

const paths = ["/feed", "/", "/all", "/search", "/settings"] as const;

export function Shell() {
  const location = useLocation();
  const navigate = useNavigate();
  const onFeed = location.pathname === "/feed";

  const value = paths.findIndex(
    (p) =>
      location.pathname === p ||
      (p !== "/" && p !== "/feed" && location.pathname.startsWith(p)),
  );

  // Shell owns Feed WebView visibility so X login survives tab switches.
  useEffect(() => {
    if (!isNativeApp()) return;
    setFeedRouteActive(onFeed);
    if (onFeed) {
      if (!isFeedUiSuspended()) void showXFeed();
    } else {
      void hideXFeed();
    }
  }, [onFeed]);

  useEffect(() => {
    if (!isNativeApp()) return;
    const sub = CapApp.addListener("backButton", ({ canGoBack }) => {
      // Capacitor's canGoBack is the host WebView, not the X feed WebView.
      if (onFeed) {
        navigate("/");
        return;
      }
      if (canGoBack) window.history.back();
      else navigate("/");
    });
    return () => {
      void sub.then((h) => h.remove());
    };
  }, [onFeed, navigate]);

  return (
    <div className={`app-shell${onFeed ? " app-shell--feed" : ""}`}>
      <Outlet />
      <Paper
        elevation={0}
        sx={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 10,
          borderRadius: 0,
          borderLeft: "none",
          borderRight: "none",
          borderBottom: "none",
        }}
      >
        <BottomNavigation
          showLabels
          value={value < 0 ? 1 : value}
          onChange={(_, next) => navigate(paths[next]!)}
          sx={{ maxWidth: 640, mx: "auto" }}
        >
          <BottomNavigationAction
            label="Feed"
            icon={<DynamicFeedOutlinedIcon />}
          />
          <BottomNavigationAction label="Folders" icon={<FolderOutlinedIcon />} />
          <BottomNavigationAction label="All" icon={<ViewListOutlinedIcon />} />
          <BottomNavigationAction label="Search" icon={<SearchOutlinedIcon />} />
          <BottomNavigationAction
            label="Settings"
            icon={<SettingsOutlinedIcon />}
          />
        </BottomNavigation>
      </Paper>
    </div>
  );
}
