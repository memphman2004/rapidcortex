#!/usr/bin/env bash
set -euo pipefail
#
# Archive RapidCortexDesktop (Release), then create RapidCortex.dmg using hdiutil.
# Prerequisites: Xcode CLI tools, valid signing (Automatic + Development Team in project).
#
# For Developer ID + notarization outside the Mac App Store, use:
#   scripts/macos-distribution-build.sh   (or scripts/publish-macos-dmg.sh with APPLE_* env set)
#
# Usage:
#   ./scripts/package-macos-dmg.sh
#   CONFIGURATION=Release OUTPUT_DIR=./dist ./scripts/package-macos-dmg.sh
#
# Output default: <repo>/dist/RapidCortex.dmg
#
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PROJECT_DIR="$ROOT/apps/desktop-macos/RapidCortexDesktop"
SCHEME="RapidCortexDesktop"
CONFIG="${CONFIGURATION:-Release}"
OUT_DIR="${OUTPUT_DIR:-$ROOT/dist}"
DMG_NAME="${DMG_FILENAME:-RapidCortex.dmg}"
VOLNAME="${DMG_VOLUME_NAME:-Rapid Cortex}"
BUILD_ROOT="$PROJECT_DIR/build/package-macos-$$"

cleanup() {
  rm -rf "$BUILD_ROOT"
}
trap cleanup EXIT

mkdir -p "$OUT_DIR"
mkdir -p "$BUILD_ROOT"

ARCHIVE="$BUILD_ROOT/RapidCortexDesktop.xcarchive"
APP="$ARCHIVE/Products/Applications/RapidCortexDesktop.app"

echo "→ xcodebuild archive ($CONFIG) …"
xcodebuild \
  -project "$PROJECT_DIR/RapidCortexDesktop.xcodeproj" \
  -scheme "$SCHEME" \
  -configuration "$CONFIG" \
  -destination "generic/platform=macOS" \
  -archivePath "$ARCHIVE" \
  -derivedDataPath "$BUILD_ROOT/DerivedData" \
  -quiet \
  archive

if [[ ! -d "$APP" ]]; then
  echo "❌ Missing archived app: $APP" >&2
  exit 1
fi

STAGING="$BUILD_ROOT/staging"
mkdir -p "$STAGING"
cp -R "$APP" "$STAGING/"

DMG_PATH="$OUT_DIR/$DMG_NAME"
rm -f "$DMG_PATH"

echo "→ hdiutil create $DMG_PATH …"
hdiutil create \
  -volname "$VOLNAME" \
  -srcfolder "$STAGING" \
  -ov \
  -format UDZO \
  -imagekey zlib-level=9 \
  "$DMG_PATH"

echo "✓ DMG ready: $DMG_PATH"
ls -lh "$DMG_PATH"
