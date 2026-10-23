import { cpSync, mkdirSync, rmSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const repoRoot = join(root, "..", "..");
const src = join(root, ".output", "chrome-mv3");

const destinations = [
  join(repoRoot, "XBookmarks-Brave"),
  join(homedir(), "Downloads", "XBookmarks-Brave"),
];

if (!existsSync(src)) {
  console.warn("Missing .output/chrome-mv3; skip Brave copy");
  process.exit(0);
}

for (const dest of destinations) {
  rmSync(dest, { recursive: true, force: true });
  mkdirSync(dest, { recursive: true });
  cpSync(src, dest, { recursive: true });
  console.log("Copied extension to", dest);
}
