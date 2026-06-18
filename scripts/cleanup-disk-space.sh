#!/usr/bin/env bash
# Free space on the boot drive (macOS). Safe for dev machines; skips active SAM build dirs on external volumes.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BEFORE="$(df -Pk /System/Volumes/Data 2>/dev/null | tail -1 | awk '{ print int($4/1024/1024) }')"
echo "Boot drive free before: ${BEFORE:-?} GiB"

free_dir() {
  local label="$1"
  local path="$2"
  if [[ -e "$path" ]]; then
    local size
    size="$(du -sh "$path" 2>/dev/null | awk '{print $1}')"
    echo "Removing ${label} (${size})..."
    rm -rf "$path"
  fi
}

# SAM / AWS CLI build caches (boot drive)
free_dir "SAM build cache (~/.rapid-cortex-sam-build)" "${HOME}/.rapid-cortex-sam-build"
free_dir "AWS SAM CLI cache (~/.aws-sam)" "${HOME}/.aws-sam"
rm -f "${HOME}/build.toml" 2>/dev/null || true

# npm / Homebrew
if command -v npm >/dev/null 2>&1; then
  echo "Cleaning npm cache..."
  npm cache clean --force >/dev/null 2>&1 || true
fi
if command -v brew >/dev/null 2>&1; then
  echo "Cleaning Homebrew cache..."
  brew cleanup -s >/dev/null 2>&1 || true
fi
free_dir "Homebrew download cache" "${HOME}/Library/Caches/Homebrew"

# pip
if command -v pip3 >/dev/null 2>&1; then
  pip3 cache purge >/dev/null 2>&1 || true
fi

# Xcode simulators (unavailable only)
if command -v xcrun >/dev/null 2>&1; then
  echo "Removing unavailable iOS simulators..."
  xcrun simctl delete unavailable >/dev/null 2>&1 || true
fi

# Cursor IDE caches (keep settings + state.vscdb; drop backup + logs + old VSIX)
free_dir "Cursor logs" "${HOME}/Library/Application Support/Cursor/logs"
free_dir "Cursor cached VSIX" "${HOME}/Library/Application Support/Cursor/CachedExtensionVSIXs"
if [[ -f "${HOME}/Library/Application Support/Cursor/User/globalStorage/state.vscdb.old" ]]; then
  echo "Removing Cursor state.vscdb.old backup..."
  rm -f "${HOME}/Library/Application Support/Cursor/User/globalStorage/state.vscdb.old"
fi

# Old repo-local SAM build dirs on boot drive only (skip external SAM_BUILD_DIR in use)
if [[ -d "${ROOT}/.rapid-cortex-sam-build" ]]; then
  free_dir "repo .rapid-cortex-sam-build" "${ROOT}/.rapid-cortex-sam-build"
fi

# Stale deploy-home from prior HOME-redirect attempts
free_dir "repo .deploy-home" "${ROOT}/.deploy-home"

AFTER="$(df -Pk /System/Volumes/Data 2>/dev/null | tail -1 | awk '{ print int($4/1024/1024) }')"
echo "Boot drive free after:  ${AFTER:-?} GiB"
if [[ -n "${BEFORE:-}" && -n "${AFTER:-}" ]]; then
  echo "Reclaimed approximately $(( AFTER - BEFORE )) GiB"
fi
