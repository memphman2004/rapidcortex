#!/usr/bin/env bash
# Archive Rapid Cortex Desktop (macOS) for Mac App Store / Transporter.
# Requires: Xcode signed into team 6D7D94PU3M, Apple Distribution cert (Xcode can create it),
# and an App Store Connect macOS app with bundle id com.rapidcortex.desktop.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PROJECT_DIR="$ROOT/apps/desktop-macos/RapidCortexDesktop"
SCHEME="RapidCortexDesktop"
CONFIG="${CONFIGURATION:-Release}"
OUT_DIR="${OUTPUT_DIR:-$ROOT/dist/macos-appstore}"
BUILD_ROOT="${MACOS_BUILD_ROOT:-$HOME/.rapid-cortex-macos-build/mas-$$}"
EXPORT_OPTIONS="$PROJECT_DIR/ExportOptions-appstore.plist"
TEAM_ID="${APPLE_TEAM_ID:-6D7D94PU3M}"

if [[ ! -f "$PROJECT_DIR/Config/Secrets.plist" ]]; then
  echo "ERROR: $PROJECT_DIR/Config/Secrets.plist missing. Copy Secrets.example.plist first (WEB_APP_BASE_URL=https://app.rapidcortex.us)." >&2
  exit 1
fi

mkdir -p "$OUT_DIR" "$BUILD_ROOT"
ARCHIVE="$BUILD_ROOT/RapidCortexDesktop.xcarchive"

cleanup() { rm -rf "$BUILD_ROOT"; }
trap cleanup EXIT

echo "→ Archive Release (automatic signing, team ${TEAM_ID}) …"
xcodebuild \
  -project "$PROJECT_DIR/RapidCortexDesktop.xcodeproj" \
  -scheme "$SCHEME" \
  -configuration "$CONFIG" \
  -destination "generic/platform=macOS" \
  -archivePath "$ARCHIVE" \
  -derivedDataPath "$BUILD_ROOT/DerivedData" \
  DEVELOPMENT_TEAM="${TEAM_ID}" \
  CODE_SIGN_STYLE=Automatic \
  archive

echo "→ Export App Store pkg …"
xcodebuild -exportArchive \
  -archivePath "$ARCHIVE" \
  -exportPath "$OUT_DIR" \
  -exportOptionsPlist "$EXPORT_OPTIONS"

echo "✓ Mac App Store export in $OUT_DIR"
ls -lh "$OUT_DIR"
echo
echo "Next: open Transporter (or xcrun altool) and upload the .pkg."
echo "App Store Connect must have a macOS app with bundle id com.rapidcortex.desktop."
echo "Prefer Unlisted App or Custom App (Apple Business Manager) — not a public consumer listing."
