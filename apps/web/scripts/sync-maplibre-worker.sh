#!/usr/bin/env bash
# Copy MapLibre 6 ESM worker + shared chunk into apps/web/public (same-origin setWorkerUrl).
# Runs from apps/web via npm postinstall/prebuild — must live under apps/web so Docker builds
# (which COPY apps/ but not repo scripts/) succeed.
set -euo pipefail
WEB_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DEST="$WEB_ROOT/public"
SRC=""
for candidate in \
  "$WEB_ROOT/../../node_modules/maplibre-gl/dist" \
  "$WEB_ROOT/node_modules/maplibre-gl/dist" \
  "$WEB_ROOT/../node_modules/maplibre-gl/dist"
do
  if [[ -f "$candidate/maplibre-gl-worker.mjs" && -f "$candidate/maplibre-gl-shared.mjs" ]]; then
    SRC="$candidate"
    break
  fi
done

if [[ -z "$SRC" ]]; then
  if [[ -f "$DEST/maplibre-gl-worker.mjs" && -f "$DEST/maplibre-gl-shared.mjs" ]]; then
    echo "maplibre worker/shared already in public/ (node_modules dist not found — ok)"
    ls -lh "$DEST/maplibre-gl-worker.mjs" "$DEST/maplibre-gl-shared.mjs"
    exit 0
  fi
  echo "maplibre-gl dist worker/shared not found under node_modules" >&2
  exit 1
fi

mkdir -p "$DEST"
cp -f "$SRC/maplibre-gl-worker.mjs" "$DEST/maplibre-gl-worker.mjs"
cp -f "$SRC/maplibre-gl-shared.mjs" "$DEST/maplibre-gl-shared.mjs"
cp -f "$SRC/maplibre-gl-worker.mjs.map" "$DEST/maplibre-gl-worker.mjs.map" 2>/dev/null || true
cp -f "$SRC/maplibre-gl-shared.mjs.map" "$DEST/maplibre-gl-shared.mjs.map" 2>/dev/null || true
ls -lh "$DEST/maplibre-gl-worker.mjs" "$DEST/maplibre-gl-shared.mjs"
