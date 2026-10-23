import { createTheme } from "@mui/material/styles";

/** Matte black + golden outlines — private XBookmarks PWA */
export const gold = {
  main: "#d4a017",
  light: "#f5c518",
  dark: "#a67c00",
  contrastText: "#0a0a0a",
};

export const theme = createTheme({
  palette: {
    mode: "dark",
    primary: gold,
    secondary: gold,
    background: {
      default: "#0a0a0a",
      paper: "#121212",
    },
    text: {
      primary: "#e8e6e3",
      secondary: "#9a9590",
    },
    divider: "rgba(212, 160, 23, 0.35)",
    error: { main: "#e57373" },
    success: { main: "#81c784" },
  },
  typography: {
    fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
    h1: { fontWeight: 700, letterSpacing: "-0.02em" },
    h2: { fontWeight: 700 },
    h5: { fontWeight: 700 },
    h6: { fontWeight: 700 },
    button: { textTransform: "none", fontWeight: 600 },
  },
  shape: { borderRadius: 12 },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          backgroundColor: "#0a0a0a",
          minHeight: "100dvh",
        },
        "#root": {
          minHeight: "100dvh",
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: "none",
          border: "1px solid rgba(212, 160, 23, 0.35)",
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          backgroundColor: "#121212",
          border: "1px solid rgba(212, 160, 23, 0.4)",
          boxShadow: "none",
        },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          "& .MuiOutlinedInput-notchedOutline": {
            borderColor: "rgba(212, 160, 23, 0.45)",
          },
          "&:hover .MuiOutlinedInput-notchedOutline": {
            borderColor: gold.light,
          },
          "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
            borderColor: gold.main,
          },
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 999,
        },
        contained: {
          boxShadow: "none",
          "&:hover": { boxShadow: "none" },
        },
        outlined: {
          borderColor: gold.main,
          color: gold.light,
          "&:hover": {
            borderColor: gold.light,
            backgroundColor: "rgba(212, 160, 23, 0.08)",
          },
        },
      },
    },
    MuiBottomNavigation: {
      styleOverrides: {
        root: {
          backgroundColor: "#0a0a0a",
          borderTop: "1px solid rgba(212, 160, 23, 0.4)",
        },
      },
    },
    MuiBottomNavigationAction: {
      styleOverrides: {
        root: {
          color: "#9a9590",
          "&.Mui-selected": { color: gold.light },
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        outlined: {
          borderColor: "rgba(212, 160, 23, 0.5)",
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          border: "1px solid rgba(212, 160, 23, 0.5)",
          backgroundColor: "#121212",
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundColor: "rgba(10, 10, 10, 0.92)",
          backgroundImage: "none",
          borderBottom: "1px solid rgba(212, 160, 23, 0.35)",
          boxShadow: "none",
        },
      },
    },
  },
});
