#!/usr/bin/env bash
set -e

SDK_DIR="$HOME/.local/android-sdk-linux"
mkdir -p "$SDK_DIR"

# Symlink platform-independent directories from Windows SDK
ln -sf "/mnt/c/Users/sarth/AppData/Local/Android/Sdk/platforms" "$SDK_DIR/platforms"
ln -sf "/mnt/c/Users/sarth/AppData/Local/Android/Sdk/licenses" "$SDK_DIR/licenses"

if [ ! -f "$SDK_DIR/cmdline-tools/latest/bin/sdkmanager" ]; then
  echo "Downloading Android Command Line Tools for Linux..."
  mkdir -p "$SDK_DIR/cmdline-tools"
  curl -fsSL https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip -o /tmp/cmdline-tools.zip
  unzip -q -o /tmp/cmdline-tools.zip -d "$SDK_DIR/cmdline-tools"
  rm -f /tmp/cmdline-tools.zip
  if [ -d "$SDK_DIR/cmdline-tools/cmdline-tools" ]; then
    mv "$SDK_DIR/cmdline-tools/cmdline-tools" "$SDK_DIR/cmdline-tools/latest"
  fi
fi

echo "Installing Linux build-tools;35.0.0 and platform-tools..."
if [ -z "$JAVA_HOME" ]; then
  JAVA_PATH=$(readlink -f $(which java 2>/dev/null) 2>/dev/null || true)
  if [ -n "$JAVA_PATH" ]; then
    export JAVA_HOME="$(dirname $(dirname $JAVA_PATH))"
  fi
fi

yes | "$SDK_DIR/cmdline-tools/latest/bin/sdkmanager" --sdk_root="$SDK_DIR" "build-tools;35.0.0" "platform-tools"

echo "Checking installed build-tools in Linux SDK:"
ls -lh "$SDK_DIR/build-tools/35.0.0" | head -n 15
