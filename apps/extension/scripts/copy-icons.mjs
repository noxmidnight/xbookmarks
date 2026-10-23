import { cpSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const src = join(root, "public", "icon");
const dest = join(root, ".output", "chrome-mv3", "icon");

if (!existsSync(src)) {
  console.warn("No public/icon directory; skipping icon copy");
  process.exit(0);
}

mkdirSync(dest, { recursive: true });
cpSync(src, dest, { recursive: true });
console.log("Copied extension icons to", dest);
