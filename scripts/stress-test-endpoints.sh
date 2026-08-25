#!/usr/bin/env bash
# Concurrent GET probe with per-endpoint success rate, p50, and p99 (curl only).
#
# Lambda/SAM (execute-api):
#   LAMBDA_BASE_URL=https://k26yw4o3xk.execute-api.us-east-1.amazonaws.com \
#   AUTH_TOKEN=eyJ... \
#   ./scripts/stress-test-endpoints.sh
#
# Next.js / ECS:
#   NEXTJS_BASE_URL=https://app.rapidcortex.us ./scripts/stress-test-endpoints.sh
#
# Both in one pass: set both *_BASE_URL vars.
set -euo pipefail

CONCURRENCY="${CONCURRENCY:-20}"
REQUESTS="${REQUESTS:-100}"
TIMEOUT_S="${TIMEOUT_S:-30}"
AUTH_TOKEN="${AUTH_TOKEN:-${BEARER_TOKEN:-}}"

LAMBDA_BASE="${LAMBDA_BASE_URL:-${API_BASE_URL:-}}"
NEXTJS_BASE="${NEXTJS_BASE_URL:-}"
LAMBDA_BASE="${LAMBDA_BASE%/}"
NEXTJS_BASE="${NEXTJS_BASE%/}"

if [[ -z "$LAMBDA_BASE" && -z "$NEXTJS_BASE" ]]; then
  echo "Set LAMBDA_BASE_URL (or API_BASE_URL) and/or NEXTJS_BASE_URL." >&2
  exit 1
fi

# Lambda/SAM endpoints (execute-api)
LAMBDA_ENDPOINTS=(
  "/api/health"
  "/api/agencies"
)

# Next.js/ECS endpoints (app.rapidcortex.us)
NEXTJS_ENDPOINTS=(
  "/api/auth/session"
  "/api/health"
)

tmpdir="$(mktemp -d)"
trap 'rm -rf "$tmpdir"' EXIT
fail=0

percentile() {
  local p="$1"
  local file="$2"
  python3 - "$p" "$file" <<'PY'
import sys
p = float(sys.argv[1])
vals = []
with open(sys.argv[2]) as f:
    for line in f:
        line = line.strip()
        if line:
            vals.append(float(line))
vals.sort()
if not vals:
    print("n/a")
    raise SystemExit
if len(vals) == 1:
    print(f"{vals[0]:.3f}")
    raise SystemExit
k = (len(vals) - 1) * (p / 100.0)
lo = int(k)
hi = min(lo + 1, len(vals) - 1)
frac = k - lo
print(f"{vals[lo] * (1 - frac) + vals[hi] * frac:.3f}")
PY
}

run_endpoint() {
  local label="$1"
  local url="$2"
  local auth="${3:-0}"
  local out="$tmpdir/$(echo "$label" | tr '/: ' '___')"

  echo "── ${label}"
  echo "   ${url}  concurrency=${CONCURRENCY} requests=${REQUESTS}"

  local curl_cmd=(curl -sS -o /dev/null --max-time "$TIMEOUT_S" -w "%{http_code} %{time_total}\n" -A "rc-stress-endpoints/1.0")
  if [[ "$auth" == "1" && -n "$AUTH_TOKEN" ]]; then
    curl_cmd+=(-H "Authorization: Bearer ${AUTH_TOKEN}")
  fi

  seq "$REQUESTS" | xargs -P "$CONCURRENCY" -n1 -I{} \
    "${curl_cmd[@]}" \
    "$url" >"$out" || true

  local total ok4xx ok2xx ok401 ok403 ok429 ok5xx other
  total=$(wc -l <"$out" | tr -d ' ')
  ok2xx=$(awk '$1 ~ /^2/ {c++} END {print c+0}' "$out")
  ok401=$(awk '$1 == 401 {c++} END {print c+0}' "$out")
  ok403=$(awk '$1 == 403 {c++} END {print c+0}' "$out")
  ok429=$(awk '$1 == 429 {c++} END {print c+0}' "$out")
  ok5xx=$(awk '$1 ~ /^5/ {c++} END {print c+0}' "$out")
  awk '{print $2}' "$out" >"${out}.times"

  local p50 p99
  p50="$(percentile 50 "${out}.times")"
  p99="$(percentile 99 "${out}.times")"
  local rate="0.00"
  if [[ "$total" -gt 0 ]]; then
    rate="$(python3 -c "print(f'{100.0 * $ok2xx / $total:.2f}')")"
  fi

  echo "   completed=${total}  2xx=${ok2xx} (${rate}%)  401=${ok401}  403=${ok403}  429=${ok429}  5xx=${ok5xx}  p50=${p50}s  p99=${p99}s"

  if [[ "$ok5xx" -gt 0 ]]; then
    echo "   FAIL: 5xx > 0" >&2
    fail=1
  fi
}

echo "Rapid Cortex endpoint stress  concurrency=${CONCURRENCY} requests=${REQUESTS}"

if [[ -n "$LAMBDA_BASE" ]]; then
  echo ""
  echo "=== Lambda/SAM  ${LAMBDA_BASE} ==="
  run_endpoint "lambda /api/health" "${LAMBDA_BASE}/api/health" 0
  if [[ -n "$AUTH_TOKEN" ]]; then
    run_endpoint "lambda /api/agencies (auth)" "${LAMBDA_BASE}/api/agencies" 1
  else
    run_endpoint "lambda /api/agencies (anon — expect 401)" "${LAMBDA_BASE}/api/agencies" 0
    echo "   note: set AUTH_TOKEN or BEARER_TOKEN for authenticated GET /api/agencies"
  fi
fi

if [[ -n "$NEXTJS_BASE" ]]; then
  echo ""
  echo "=== Next.js/ECS  ${NEXTJS_BASE} ==="
  for path in "${NEXTJS_ENDPOINTS[@]}"; do
    run_endpoint "nextjs ${path}" "${NEXTJS_BASE}${path}" 0
  done
fi

echo ""
if [[ "$fail" -ne 0 ]]; then
  echo "stress-test-endpoints: FAIL (see 5xx above)"
  exit 1
fi
echo "stress-test-endpoints: OK"
exit 0
