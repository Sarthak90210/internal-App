#!/usr/bin/env bash
set -e

echo "=== Setting up Linux Node.js ==="
if [ ! -f /tmp/node-linux/bin/node ]; then
  echo "Downloading Linux Node.js (v22.13.0)..."
  mkdir -p /tmp/node-linux
  curl -fsSL https://nodejs.org/dist/v22.13.0/node-v22.13.0-linux-x64.tar.xz | tar -xJ -C /tmp/node-linux --strip-components=1
fi
export PATH="/tmp/node-linux/bin:$PATH"

echo "Node version: $(node -v)"
echo "npm version: $(npm -v)"
echo "Which node: $(which node)"

echo "=== Setting up Java ==="
if [ -z "$JAVA_HOME" ]; then
  JAVA_PATH=$(readlink -f $(which java 2>/dev/null) 2>/dev/null || true)
  if [ -n "$JAVA_PATH" ]; then
    export JAVA_HOME="$(dirname $(dirname $JAVA_PATH))"
  fi
fi
echo "JAVA_HOME: $JAVA_HOME"
echo "Java version: $(java -version 2>&1 | head -n 1)"

echo "=== Setting up Linux Android SDK ==="
SDK_DIR="/tmp/android-sdk-linux"
if [ ! -f "$SDK_DIR/build-tools/35.0.0/aapt2" ]; then
  echo "Running Linux SDK setup..."
  bash "$(dirname "$0")/setup_linux_sdk.sh"
fi

export ANDROID_HOME="$SDK_DIR"
export ANDROID_SDK_ROOT="$ANDROID_HOME"
export PATH="$ANDROID_HOME/platform-tools:$PATH"
echo "ANDROID_HOME: $ANDROID_HOME"

echo "=== Stopping any old Gradle Daemons ==="
cd "$(dirname "$0")/../android"
chmod +x gradlew
./gradlew --stop || true

echo "=== Building Android APK in Release Mode (--no-daemon) ==="
# Run gradle assembleRelease without daemon to ensure fresh PATH and Linux SDK environment
./gradlew --no-daemon assembleRelease --stacktrace

echo "=== Checking build output ==="
APK_SOURCE="app/build/outputs/apk/release/app-release.apk"
if [ -f "$APK_SOURCE" ]; then
  DEST_DIR="../APK Builds"
  mkdir -p "$DEST_DIR"
  DEST_FILE="$DEST_DIR/RFV_Internal_App_V1.1.1.apk"
  cp "$APK_SOURCE" "$DEST_FILE"
  echo "SUCCESS! APK built and copied to: $DEST_FILE"
  ls -lh "$DEST_FILE"
else
  echo "ERROR: Could not find generated APK at $APK_SOURCE"
  find app/build/outputs/apk -name "*.apk" 2>/dev/null || true
  exit 1
fi
