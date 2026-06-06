#!/usr/bin/env bash
set -euo pipefail
#
# Build DMG then upload to S3 + merge latest.json (same as docs/desktop-downloads.md).
#
# Usage:
#   ./scripts/publish-macos-dmg.sh prod 1.0.0
#
# Env (optional): CONFIGURATION, OUTPUT_DIR, DOWNLOADS_STACK_NAME, AWS_REGION, etc.
#
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENVIRONMENT="${1:?Usage: $0 <env> <semver-version> — e.g. $0 prod 1.0.0}"
VERSION="${2:?}"

DMG_PATH="${DMG_PATH:-$ROOT/dist/RapidCortex.dmg}"

# Outside-Mac-App-Store: Developer ID + notarization when APPLE_* env is set; else local UDZO only.
if [[ -n "${APPLE_DEVELOPER_ID:-}" && -n "${APPLE_TEAM_ID:-}" && -n "${APPLE_ID:-}" && -n "${APPLE_APP_PASSWORD:-}" ]]; then
  export OUTPUT_DIR="$(cd "$(dirname "$DMG_PATH")" && pwd)"
  export DMG_FILENAME="$(basename "$DMG_PATH")"
  "$ROOT/scripts/macos-distribution-build.sh"
else
  echo "ℹ️  APPLE_DEVELOPER_ID / full notarization env not set — using package-macos-dmg.sh (no notarytool)."
  "$ROOT/scripts/package-macos-dmg.sh"
fi

"$ROOT/scripts/upload-desktop-downloads.sh" "$ENVIRONMENT" mac "$DMG_PATH" "$VERSION"
