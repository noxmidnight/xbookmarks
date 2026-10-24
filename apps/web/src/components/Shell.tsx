import { Outlet, useLocation, useNavigate } from "react-router-dom";
import BottomNavigation from "@mui/material/BottomNavigation";
import BottomNavigationAction from "@mui/material/BottomNavigationAction";
import IconButton from "@mui/material/IconButton";
import Paper from "@mui/material/Paper";
import Tooltip from "@mui/material/Tooltip";
import BookmarkAddIcon from "@mui/icons-material/BookmarkAdd";
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
  warmXFeed,
} from "../lib/xFeed";
import { getFeedChromeState, subscribeFeedChrome } from "../lib/feedUi";
import { useEffect, useState } from "react";
import { App as CapApp } from "@capacitor/app";

const paths = ["/feed", "/", "/all", "/search", "/settings"] as const;

export function Shell() {
  const location = useLocation();
  const navigate = useNavigate();
  const onFeed = location.pathname === "/feed";
  const [feedChrome, setFeedChrome] = useState(getFeedChromeState);

  const value = paths.findIndex(
    (p) =>
      location.pathname === p ||
      (p !== "/" && p !== "/feed" && location.pathname.startsWith(p)),
  );

  useEffect(() => subscribeFeedChrome(setFeedChrome), []);

  // Prefetch Feed WebView once so login cookies survive tab switches / faster open.
  useEffect(() => {
    if (!isNativeApp()) return;
    void warmXFeed();
  }, []);

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

  // Always show the bookmark FAB on Feed (disabled until a tweet URL is open).
  const showBookmark = onFeed && isNativeApp();

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
          zIndex: 30,
          borderRadius: 0,
          borderLeft: "none",
          borderRight: "none",
          borderBottom: "none",
          pb: "env(safe-area-inset-bottom, 0px)",
          bgcolor: "background.paper",
        }}
      >
        <BottomNavigation
          showLabels
          value={value < 0 ? 1 : value}
          onChange={(_, next) => navigate(paths[next]!)}
          sx={{
            maxWidth: 640,
            mx: "auto",
            position: "relative",
            // Reserve a slot on the right so the bookmark button never covers a tab.
            pr: showBookmark ? "60px" : 0,
          }}
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
        {showBookmark ? (
          <Tooltip
            title={
              feedChrome.canBookmark
                ? "Save to folder"
                : "Open a tweet, then tap Bookmark"
            }
          >
            <span>
              <IconButton
                color="primary"
                disabled={feedChrome.busy || !feedChrome.canBookmark}
                onClick={() => feedChrome.onBookmark?.()}
                aria-label="Bookmark tweet"
                sx={{
                  position: "absolute",
                  right: 8,
                  top: 4,
                  zIndex: 20,
                  bgcolor: "primary.main",
                  color: "background.default",
                  boxShadow: 3,
                  width: 48,
                  height: 48,
                  "&:hover": { bgcolor: "primary.dark" },
                  "&.Mui-disabled": {
                    bgcolor: "action.disabledBackground",
                    color: "text.disabled",
                  },
                }}
              >
                <BookmarkAddIcon />
              </IconButton>
            </span>
          </Tooltip>
        ) : null}
      </Paper>
    </div>
  );
}
