#!/usr/bin/env bash
set -euo pipefail

#
# Run one k6 profile and write the log name the PDF generator expects:
#   results/smoke-run-<timestamp>.log
#   results/load-run-<timestamp>.log
#
# Also copies handleSummary JSON to results/<profile>/k6-summary.json.
# CloudWatch polling is a separate process (scripts/rc-stress-monitor.sh) —
# it does not write these k6 logs.
#
# Usage:
#   bash scripts/run-k6-profile.sh smoke
#   API_BASE=https://... WEB_BASE=https://... BEARER_TOKEN=... bash scripts/run-k6-profile.sh load
#

PROFILE="${1:?Usage: $0 <smoke|ramp|load|stress|soak|spike>}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

RESULTS_DIR="${ROOT}/results"
K6_SCRIPT="${ROOT}/scripts/perf/rc-stress-test.js"
STAMP="$(date +%Y%m%d-%H%M%S)"
LOG="${RESULTS_DIR}/${PROFILE}-run-${STAMP}.log"
LATEST="${RESULTS_DIR}/${PROFILE}-run-latest.log"
PROFILE_DIR="${RESULTS_DIR}/${PROFILE}"

command -v k6 >/dev/null 2>&1 || {
  echo "k6 not found on PATH. Install with: brew install k6" >&2
  exit 2
}

mkdir -p "$RESULTS_DIR" "$PROFILE_DIR"
rm -f "${RESULTS_DIR}/k6-summary.json"

echo "[RC] k6 profile=${PROFILE}  log=${LOG}"

set +e
set -o pipefail
LOAD_PROFILE="$PROFILE" \
  API_BASE="${API_BASE:-${RC_API_BASE:-${API_BASE_URL:-}}}" \
  WEB_BASE="${WEB_BASE:-${RC_WEB_BASE:-}}" \
  BEARER_TOKEN="${BEARER_TOKEN:-${RC_BEARER:-${STRESS_BEARER_TOKEN:-}}}" \
  ALLOW_WRITES="${STRESS_ALLOW_WRITES:-${ALLOW_WRITES:-0}}" \
  k6 run --out "json=${PROFILE_DIR}/k6-raw.json" "$K6_SCRIPT" 2>&1 | tee "$LOG"
k6_status=${PIPESTATUS[0]}
set +o pipefail
set -e

ln -sfn "$(basename "$LOG")" "$LATEST"

if [[ -f "${RESULTS_DIR}/k6-summary.json" ]]; then
  cp "${RESULTS_DIR}/k6-summary.json" "${PROFILE_DIR}/k6-summary.json"
fi

exit "$k6_status"
