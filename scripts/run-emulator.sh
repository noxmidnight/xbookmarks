#!/usr/bin/env bash
# Start the Android emulator, install XBookmarks.apk, and launch the app.
# Usage: pnpm emu   |   ./scripts/run-emulator.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
export JAVA_HOME="${JAVA_HOME:-$HOME/.local/jdk-21}"
export ANDROID_HOME="${ANDROID_HOME:-$HOME/Android/Sdk}"
export PATH="$JAVA_HOME/bin:$ANDROID_HOME/emulator:$ANDROID_HOME/platform-tools:$PATH"

AVD="${XB_AVD:-xbookmarks_pixel}"
APK="${XB_APK:-$ROOT/dist/android/XBookmarks.apk}"
PKG="app.xbookmarks.mobile"

if [[ ! -x "$ANDROID_HOME/emulator/emulator" ]]; then
  echo "Android emulator not found at $ANDROID_HOME/emulator/emulator" >&2
  exit 1
fi

if [[ ! -f "$APK" ]]; then
  echo "APK missing: $APK" >&2
  echo "Build first: pnpm build:android" >&2
  exit 1
fi

if ! emulator -list-avds 2>/dev/null | grep -qx "$AVD"; then
  echo "AVD '$AVD' not found. Available:" >&2
  emulator -list-avds >&2 || true
  exit 1
fi

# Already running?
if ! adb devices 2>/dev/null | grep -qE 'emulator-[0-9]+\s+device'; then
  echo "Starting emulator ($AVD)…"
  emulator -avd "$AVD" -gpu swiftshader_indirect >/tmp/xbookmarks-emulator.log 2>&1 &
  echo "  log: /tmp/xbookmarks-emulator.log"
else
  echo "Emulator already running."
fi

echo "Waiting for device…"
adb wait-for-device

echo "Waiting for boot…"
for _ in $(seq 1 90); do
  if [[ "$(adb shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')" == "1" ]]; then
    break
  fi
  sleep 2
done
if [[ "$(adb shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')" != "1" ]]; then
  echo "Emulator boot timed out." >&2
  exit 1
fi

adb shell svc wifi enable >/dev/null 2>&1 || true

echo "Installing $APK…"
adb install -r "$APK"

echo "Launching $PKG…"
adb shell am start -n "$PKG/.MainActivity" >/dev/null

echo "Done. XBookmarks is on the emulator."
