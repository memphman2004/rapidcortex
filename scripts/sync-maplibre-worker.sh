#!/usr/bin/env bash
# Wrapper — canonical copy lives under apps/web (Docker COPY apps/).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
exec bash "$ROOT/apps/web/scripts/sync-maplibre-worker.sh"
