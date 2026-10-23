import type { FolderColor } from "./types";

export const FOLDER_COLORS: readonly FolderColor[] = [
  "sky",
  "emerald",
  "amber",
  "rose",
  "violet",
  "slate",
  "orange",
  "teal",
] as const;

export const FOLDER_COLOR_HEX: Record<FolderColor, string> = {
  sky: "#0ea5e9",
  emerald: "#10b981",
  amber: "#f59e0b",
  rose: "#f43f5e",
  violet: "#8b5cf6",
  slate: "#64748b",
  orange: "#f97316",
  teal: "#14b8a6",
};

export function nextFolderColor(index: number): FolderColor {
  return FOLDER_COLORS[index % FOLDER_COLORS.length]!;
}
