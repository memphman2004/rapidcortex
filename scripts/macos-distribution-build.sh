#!/usr/bin/env bash
#
# Rapid Cortex macOS — Developer ID sign, UDZO .dmg, Apple notarization (notarytool), staple.
# Outside Mac App Store distribution. Requires Xcode + valid Developer ID Application cert in keychain.
#
# Environment (required for full pipeline including notarization):
#   APPLE_DEVELOPER_ID   Full codesign identity, e.g. "Developer ID Application: Your Name (TEAMID)"
#   APPLE_ID             Apple ID email (notarytool --apple-id)
#   APPLE_APP_PASSWORD   App-specific password (appleid.apple.com)
#   APPLE_TEAM_ID        10-character Team ID (notarytool --team-id)
#
# Optional:
#   CONFIGURATION        default Release
#   OUTPUT_DIR           default <repo>/dist
#   DMG_FILENAME         default RapidCortex.dmg
#   DMG_VOLUME_NAME      default "Rapid Cortex"
#   SKIP_NOTARIZE        set to 1 to sign + DMG only (no notarytool; for local smoke)
#
# Usage:
#   export APPLE_DEVELOPER_ID="Developer ID Application: …"
#   export APPLE_ID="you@example.com"
#   export APPLE_APP_PASSWORD="xxxx-xxxx-xxxx-xxxx"
#   export APPLE_TEAM_ID="XXXXXXXXXX"
#   ./scripts/macos-distribution-build.sh
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PROJECT_DIR="$ROOT/apps/desktop-macos/RapidCortexDesktop"
SCHEME="RapidCortexDesktop"
CONFIG="${CONFIGURATION:-Release}"
OUT_DIR="${OUTPUT_DIR:-$ROOT/dist}"
DMG_NAME="${DMG_FILENAME:-RapidCortex.dmg}"
VOLNAME="${DMG_VOLUME_NAME:-Rapid Cortex}"
ENTITLEMENTS="$PROJECT_DIR/RapidCortexDesktop/RapidCortexDesktop.entitlements"
# Keep archives/DMG on repo dist/; DerivedData on local disk (external volumes can hang xcodebuild).
BUILD_ROOT="${MACOS_BUILD_ROOT:-$HOME/.rapid-cortex-macos-build/dist-macos-$$}"

: "${APPLE_DEVELOPER_ID:?Set APPLE_DEVELOPER_ID (Developer ID Application identity string)}"
: "${APPLE_TEAM_ID:?Set APPLE_TEAM_ID (matches DEVELOPMENT_TEAM / notarytool --team-id)}"

if [[ "${SKIP_NOTARIZE:-0}" != "1" ]]; then
  : "${APPLE_ID:?Set APPLE_ID for notarytool}"
  : "${APPLE_APP_PASSWORD:?Set APPLE_APP_PASSWORD (app-specific password)}"
fi

cleanup() {
  rm -rf "$BUILD_ROOT"
}
trap cleanup EXIT

mkdir -p "$OUT_DIR"
mkdir -p "$BUILD_ROOT"

ARCHIVE="$BUILD_ROOT/RapidCortexDesktop.xcarchive"
ARCHIVED_APP="$ARCHIVE/Products/Applications/RapidCortexDesktop.app"
STAGING="$BUILD_ROOT/staging"
DMG_PATH="$OUT_DIR/$DMG_NAME"

echo "→ xcodebuild archive ($CONFIG, generic macOS) …"
# Prefer Developer ID + team for archive signing when distributing outside the App Store.
xcodebuild \
  -project "$PROJECT_DIR/RapidCortexDesktop.xcodeproj" \
  -scheme "$SCHEME" \
  -configuration "$CONFIG" \
  -destination "generic/platform=macOS" \
  -archivePath "$ARCHIVE" \
  -derivedDataPath "$BUILD_ROOT/DerivedData" \
  DEVELOPMENT_TEAM="${APPLE_TEAM_ID}" \
  CODE_SIGN_STYLE=Manual \
  CODE_SIGN_IDENTITY="${APPLE_DEVELOPER_ID}" \
  -quiet \
  archive

if [[ ! -d "$ARCHIVED_APP" ]]; then
  echo "❌ Missing archived app: $ARCHIVED_APP" >&2
  exit 1
fi

mkdir -p "$STAGING"
ditto "$ARCHIVED_APP" "$STAGING/RapidCortexDesktop.app"

echo "→ codesign (Developer ID, hardened runtime) …"
codesign --force --deep --timestamp \
  --options runtime \
  --entitlements "$ENTITLEMENTS" \
  --sign "$APPLE_DEVELOPER_ID" \
  "$STAGING/RapidCortexDesktop.app"

codesign --verify --verbose=2 "$STAGING/RapidCortexDesktop.app"
spctl --assess --type execute -v "$STAGING/RapidCortexDesktop.app" || {
  echo "⚠️  spctl assess reported an issue (gatekeeper); notarization may still succeed." >&2
}

rm -f "$DMG_PATH"
echo "→ hdiutil create $DMG_PATH …"
hdiutil create \
  -volname "$VOLNAME" \
  -srcfolder "$STAGING" \
  -ov \
  -format UDZO \
  -imagekey zlib-level=9 \
  "$DMG_PATH"

if [[ "${SKIP_NOTARIZE:-0}" == "1" ]]; then
  echo "✓ Signed DMG ready (SKIP_NOTARIZE=1): $DMG_PATH"
  ls -lh "$DMG_PATH"
  exit 0
fi

if ! command -v xcrun &>/dev/null; then
  echo "❌ xcrun not found; install Xcode CLI tools." >&2
  exit 1
fi

echo "→ notarytool submit (wait for Apple) …"
xcrun notarytool submit "$DMG_PATH" \
  --apple-id "$APPLE_ID" \
  --password "$APPLE_APP_PASSWORD" \
  --team-id "$APPLE_TEAM_ID" \
  --wait

echo "→ stapler staple …"
xcrun stapler staple "$DMG_PATH"
xcrun stapler validate "$DMG_PATH"

echo "✓ Signed + notarized DMG: $DMG_PATH"
ls -lh "$DMG_PATH"
