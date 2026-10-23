import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

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
  cwd: new URL("../android", import.meta.url).pathname,
  env: {
    ...env,
    PATH: `${env.JAVA_HOME}/bin:${sdk}/platform-tools:${env.PATH || ""}`,
  },
  stdio: "inherit",
});

process.exit(result.status ?? 1);
