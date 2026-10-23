import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const webRoot = new URL("..", import.meta.url).pathname;
const repoRoot = join(webRoot, "..", "..");
const jdk21 = join(homedir(), ".local", "jdk-21");
const sdk = process.env.ANDROID_HOME || join(homedir(), "Android", "Sdk");

const env = {
  ...process.env,
  JAVA_HOME: existsSync(join(jdk21, "bin", "java"))
    ? jdk21
    : process.env.JAVA_HOME,
  ANDROID_HOME: sdk,
};

const result = spawnSync("./gradlew", ["assembleDebug", "--no-daemon"], {
  cwd: join(webRoot, "android"),
  env: {
    ...env,
    PATH: `${env.JAVA_HOME}/bin:${sdk}/platform-tools:${env.PATH || ""}`,
  },
  stdio: "inherit",
});

if ((result.status ?? 1) !== 0) {
  process.exit(result.status ?? 1);
}

const builtApk = join(
  webRoot,
  "android",
  "app",
  "build",
  "outputs",
  "apk",
  "debug",
  "app-debug.apk",
);

if (!existsSync(builtApk)) {
  console.error("APK not found at", builtApk);
  process.exit(1);
}

const destinations = [
  join(repoRoot, "dist", "android"),
  join(homedir(), "Downloads", "XBookmarks", "android"),
];

for (const dir of destinations) {
  mkdirSync(dir, { recursive: true });
  const dest = join(dir, "XBookmarks.apk");
  cpSync(builtApk, dest);
  writeFileSync(
    join(dir, "README.txt"),
    "XBookmarks Android app\n\nInstall XBookmarks.apk (allow unknown sources).\nRebuild: pnpm build:android\n",
    "utf8",
  );
  console.log("Copied APK to", dest);
}
