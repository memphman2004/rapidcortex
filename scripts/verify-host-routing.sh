#!/usr/bin/env bash
# Verify marketing vs app host split (app → login / www redirects; www → static marketing).
#
# Usage:
#   ./scripts/verify-host-routing.sh                          # production URLs
#   ./scripts/verify-host-routing.sh --local http://127.0.0.1:3000   # CodeBuild container probe (uses Host: app.rapidcortex.us)
#
# Env:
#   APP_ORIGIN / WWW_ORIGIN — override defaults (https://app.rapidcortex.us, https://www.rapidcortex.us)
#   APP_HOST — Host header for --local mode (default app.rapidcortex.us)
#   SMOKE_TIMEOUT_SECONDS — curl timeout (default 15)
#   ROUTING_VERIFY_ALB_ORIGIN — bypass CloudFront (e.g. http://alb-xxx.elb.amazonaws.com); app checks use Host: app.*
#   SKIP_HOST_ROUTING_VERIFY=1 — no-op success (escape hatch)
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

APP_HOST="${APP_HOST:-app.rapidcortex.us}"
WWW_HOST="${WWW_HOST:-www.rapidcortex.us}"
APP_ORIGIN="${APP_ORIGIN:-https://${APP_HOST}}"
WWW_ORIGIN="${WWW_ORIGIN:-https://${WWW_HOST}}"
TIMEOUT="${SMOKE_TIMEOUT_SECONDS:-15}"
LOCAL_BASE=""
ROUTING_VERIFY_ALB_ORIGIN="${ROUTING_VERIFY_ALB_ORIGIN:-}"
ROUTING_VERIFY_ALB_ORIGIN="${ROUTING_VERIFY_ALB_ORIGIN%/}"
CACHE_BUST="rc_verify=$(date +%s)"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --local)
      LOCAL_BASE="${2:?--local requires base URL, e.g. http://127.0.0.1:3000}"
      LOCAL_BASE="${LOCAL_BASE%/}"
      shift 2
      ;;
    -h | --help)
      sed -n '1,20p' "$0"
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      exit 2
      ;;
  esac
done

if [[ "${SKIP_HOST_ROUTING_VERIFY:-0}" == "1" ]]; then
  echo "SKIP_HOST_ROUTING_VERIFY=1 — skipping host routing checks"
  exit 0
fi

curl_app() {
  local path="$1"
  shift
  local url_path="${path}"
  if [[ -n "${LOCAL_BASE}" ]]; then
    curl -sS -m "${TIMEOUT}" -H "Host: ${APP_HOST}" "$@" "${LOCAL_BASE}${url_path}"
  elif [[ -n "${ROUTING_VERIFY_ALB_ORIGIN}" ]]; then
    # ALB :443 is public; :80 is CloudFront prefix-list only. Cert is for app.*, not ALB DNS — use -k.
    curl -sS -m "${TIMEOUT}" -k -H "Host: ${APP_HOST}" "$@" "${ROUTING_VERIFY_ALB_ORIGIN}${url_path}"
  else
    local sep="?"
    [[ "${url_path}" == *"?"* ]] && sep="&"
    curl -sS -m "${TIMEOUT}" \
      -H "Cache-Control: no-cache" \
      -H "Pragma: no-cache" \
      "$@" "${APP_ORIGIN}${url_path}${sep}${CACHE_BUST}"
  fi
}

curl_www() {
  local path="$1"
  shift
  curl -sS -m "${TIMEOUT}" "$@" "${WWW_ORIGIN}${path}"
}

# Returns status code (no follow redirects).
fetch_status() {
  local fn="$1"
  local path="$2"
  "${fn}" "${path}" -o /dev/null -w '%{http_code}' -D /tmp/rc-host-routing-headers.$$ 2>/dev/null || echo "000"
}

fetch_location() {
  grep -i '^location:' /tmp/rc-host-routing-headers.$$ 2>/dev/null | tail -1 | awk '{print $2}' | tr -d '\r' || true
}

cleanup_headers() {
  rm -f /tmp/rc-host-routing-headers.$$
}

failures=0

check_redirect() {
  local label="$1"
  local fetch_fn="$2"
  local path="$3"
  local expect_location_pattern="$4"

  local status location
  status="$(fetch_status "${fetch_fn}" "${path}")"
  location="$(fetch_location)"
  cleanup_headers

  if [[ ! "${status}" =~ ^30[1278]$ ]]; then
    echo "FAIL — ${label}: expected 30x redirect, got HTTP ${status}" >&2
    failures=$((failures + 1))
    return
  fi
  if [[ -n "${expect_location_pattern}" ]] && ! grep -qE "${expect_location_pattern}" <<<"${location}"; then
    echo "FAIL — ${label}: Location \"${location}\" did not match /${expect_location_pattern}/" >&2
    failures=$((failures + 1))
    return
  fi
  echo "OK   — ${label}: ${status} → ${location}"
}

check_ok_200() {
  local label="$1"
  local fetch_fn="$2"
  local path="$3"

  local status
  status="$(fetch_status "${fetch_fn}" "${path}")"
  cleanup_headers

  if [[ "${status}" != "200" ]]; then
    echo "FAIL — ${label}: expected HTTP 200, got ${status}" >&2
    failures=$((failures + 1))
    return
  fi
  echo "OK   — ${label}: HTTP 200"
}

check_not_marketing_200() {
  local label="$1"
  local path="$2"

  local status body_snip
  status="$(curl_app "${path}" -o /tmp/rc-host-routing-body.$$ -w '%{http_code}' 2>/dev/null || echo "000")"
  body_snip="$(head -c 400 /tmp/rc-host-routing-body.$$ 2>/dev/null || true)"
  rm -f /tmp/rc-host-routing-body.$$

  if [[ "${status}" == "200" ]] && grep -q 'Intelligence When Every Second Matters' <<<"${body_snip}"; then
    echo "FAIL — ${label}: app host returned marketing homepage (HTTP 200)" >&2
    failures=$((failures + 1))
    return
  fi
  if [[ "${status}" == "200" ]]; then
    echo "FAIL — ${label}: app host returned HTTP 200 for ${path} (expected redirect away from marketing)" >&2
    failures=$((failures + 1))
    return
  fi
  if [[ "${status}" == "000" || -z "${status}" ]]; then
    echo "FAIL — ${label}: no HTTP response for ${path} (status ${status})" >&2
    failures=$((failures + 1))
    return
  fi
  echo "OK   — ${label}: not serving marketing 200 (status ${status})"
}

echo "Host routing verification"
if [[ -n "${LOCAL_BASE}" ]]; then
  echo "  mode=local base=${LOCAL_BASE} Host=${APP_HOST}"
elif [[ -n "${ROUTING_VERIFY_ALB_ORIGIN}" ]]; then
  echo "  mode=alb-origin base=${ROUTING_VERIFY_ALB_ORIGIN} Host=${APP_HOST} (bypasses CloudFront cache)"
else
  echo "  mode=production app=${APP_ORIGIN} www=${WWW_ORIGIN} (cache-bust query on app checks)"
fi
echo "---"

check_redirect "app / → login" curl_app "/" '/login'
check_redirect "app /pricing → www" curl_app "/pricing" 'www\.rapidcortex\.us'
check_redirect "app /product → www" curl_app "/product" 'www\.rapidcortex\.us'
check_not_marketing_200 "app /pricing not marketing" "/pricing"

if [[ -z "${LOCAL_BASE}" ]]; then
  check_ok_200 "www /" curl_www "/"
  check_ok_200 "www /pricing" curl_www "/pricing"
fi

echo "---"
if (( failures > 0 )); then
  echo "Host routing verification FAILED (${failures} check(s))" >&2
  exit 1
fi
echo "Host routing verification passed"
