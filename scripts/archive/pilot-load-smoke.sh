#!/usr/bin/env bash
# Pilot concurrency probe: parallel GET /api/health against a deployed API.
# Not a full soak test — quick sanity before windows or after scaling changes.
# Usage:
#   CONCURRENCY=30 REQUESTS=200 API_BASE_URL=https://... ./scripts/pilot-load-smoke.sh
set -euo pipefail
BASE="${API_BASE_URL:-}"
if [[ -z "$BASE" ]]; then
  echo "Set API_BASE_URL to the stack HttpApiUrl (or custom domain base)." >&2
  exit 1
fi
BASE="${BASE%/}"
CONCURRENCY="${CONCURRENCY:-20}"
REQUESTS="${REQUESTS:-100}"
seq "$REQUESTS" | xargs -P "$CONCURRENCY" -n1 -I{} \
  curl -sSf -o /dev/null "${BASE}/api/health"
echo "pilot-load-smoke: OK (${REQUESTS} requests, xargs -P ${CONCURRENCY})"
