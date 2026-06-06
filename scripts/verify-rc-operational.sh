#!/usr/bin/env bash
# End-to-end readiness: primary API, optional stack-2 API, Next.js web + aggregated chain.
# Exit 0 only when required endpoints report healthy (adjust expectations if stack2 is intentionally unset).
#
# Usage:
#   source scripts/env-web-ssr-prod.sh   # or export vars manually
#   ./scripts/verify-rc-operational.sh
#
# Or override:
#   WEB_ORIGIN=https://www.rapidcortex.us API_BASE_URL=https://xxx.execute-api....amazonaws.com ./scripts/verify-rc-operational.sh
#
set -euo pipefail

WEB_ORIGIN="${WEB_ORIGIN:-${NEXT_PUBLIC_SITE_URL:-}}"
WEB_ORIGIN="${WEB_ORIGIN:-}"
API_BASE_URL="${API_BASE_URL:-${API_UPSTREAM_BASE:-}}"
API_BASE_URL="${API_BASE_URL:-}"
API_BASE_URL_2="${API_BASE_URL_2:-${API_UPSTREAM_BASE_2:-}}"
API_BASE_URL_2="${API_BASE_URL_2:-}"

fail() {
  echo "❌ $*" >&2
  exit 1
}

ok() {
  echo "✅ $*"
}

require_json_health() {
  local base="$1"
  local label="$2"
  base="${base%/}"
  local code body
  code="$(curl -sS -o /tmp/rc-health-probe.json -w "%{http_code}" "${base}/api/health" \
    --connect-timeout 10 --max-time 25)" || fail "${label}: curl failed (${base}/api/health)"
  if [[ "$code" != "200" ]]; then
    cat /tmp/rc-health-probe.json >&2 || true
    fail "${label}: HTTP ${code} (${base}/api/health)"
  fi
  python3 -c "import json; d=json.load(open('/tmp/rc-health-probe.json')); assert d.get('status')=='ok' and d.get('service')=='rapid-cortex-api'" \
    2>/dev/null || fail "${label}: unexpected JSON (${base}/api/health)"
  ok "${label} GET ${base}/api/health"
}

echo "════════ Rapid Cortex operational probe ════════"

if [[ -n "$API_BASE_URL" ]]; then
  require_json_health "$API_BASE_URL" "Primary API (stack 1)"
else
  echo "⚠️  API_BASE_URL / API_UPSTREAM_BASE not set — skipping primary API direct check"
fi

if [[ -n "$API_BASE_URL_2" ]]; then
  require_json_health "$API_BASE_URL_2" "Secondary API (stack 2)"
else
  ok "Secondary API (stack 2) skipped — API_UPSTREAM_BASE_2 / API_BASE_URL_2 unset"
fi

if [[ -n "$WEB_ORIGIN" ]]; then
  WEB_ORIGIN="${WEB_ORIGIN%/}"
  echo "--- Web origin: ${WEB_ORIGIN} ---"
  code="$(curl -sS -o /tmp/rc-web-health.json -w "%{http_code}" "${WEB_ORIGIN}/api/health" \
    --connect-timeout 10 --max-time 25)" || fail "Web /api/health curl failed"
  [[ "$code" == "200" ]] || fail "Web /api/health HTTP ${code}"
  ok "Web GET ${WEB_ORIGIN}/api/health"

  # Prefer flat path (rewrite → same handler): less surface for CDN path quirks than `/api/health/chain`.
  code="$(curl -sS -o /tmp/rc-chain.json -w "%{http_code}" "${WEB_ORIGIN}/api/health-chain" \
    --connect-timeout 10 --max-time 35)" || fail "Web /api/health-chain curl failed"
  if [[ "$code" != "200" ]]; then
    cat /tmp/rc-chain.json >&2 || true
    fail "Web /api/health-chain HTTP ${code} — fix API_UPSTREAM_BASE, Cognito env, or API stacks"
  fi
  python3 <<'PY' || fail "Chain body missing ok:true"
import json,sys
d=json.load(open("/tmp/rc-chain.json"))
assert d.get("ok") is True, d
PY
  ok "Web GET ${WEB_ORIGIN}/api/health-chain (aggregated ok)"

  code="$(curl -sS -o /tmp/rc-upstream.json -w "%{http_code}" "${WEB_ORIGIN}/api/health/upstream" \
    --connect-timeout 10 --max-time 35)" || fail "Web /api/health/upstream curl failed"
  [[ "$code" == "200" ]] || { cat /tmp/rc-upstream.json >&2 || true; fail "Web /api/health/upstream HTTP ${code} — API_UPSTREAM_BASE likely missing or API unreachable from SSR"; }
  ok "Web GET ${WEB_ORIGIN}/api/health/upstream (BFF → primary API)"
else
  echo "⚠️  WEB_ORIGIN / NEXT_PUBLIC_SITE_URL not set — skipping web checks (set to https://www.rapidcortex.us for prod)"
fi

echo "════════ All executed checks passed ════════"
