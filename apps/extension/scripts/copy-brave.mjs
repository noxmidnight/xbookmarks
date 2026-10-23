import { cpSync, mkdirSync, rmSync, existsSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const repoRoot = join(root, "..", "..");
const src = join(root, ".output", "chrome-mv3");

/** Unpacked extension lives only under dist/extension (+ optional Downloads mirror). */
const destinations = [
  join(repoRoot, "dist", "extension"),
  join(homedir(), "Downloads", "XBookmarks", "extension"),
];

if (!existsSync(src)) {
  console.warn("Missing .output/chrome-mv3; skip extension copy");
  process.exit(0);
}

for (const dest of destinations) {
  rmSync(dest, { recursive: true, force: true });
  mkdirSync(dest, { recursive: true });
  cpSync(src, dest, { recursive: true });
  writeFileSync(
    join(dest, "README.txt"),
    "XBookmarks browser extension (Brave / Chrome)\n\nLoad unpacked from this folder in brave://extensions\n",
    "utf8",
  );
  console.log("Copied extension to", dest);
}
