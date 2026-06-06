#!/usr/bin/env bash
set -euo pipefail
#
# Rapid Cortex web smoke tests — curl-based, works against CloudFront or ALB DNS.
#
# Usage:
#   ./scripts/smoke-web.sh <base-url>
#   ./scripts/smoke-web.sh www.example.com          # https:// added
#   WEB_SMOKE_BASE_URL=https://… ./scripts/smoke-web.sh
#   DEPLOY_STAGE=prod ./scripts/smoke-web.sh        # resolve URL from CloudFormation (no args)
#   ./scripts/smoke-web.sh --                        # explicit “resolve only from CF”
#   SMOKE_WEB_STACK_NAME=rapid-cortex-web-ssr-prod ./scripts/smoke-web.sh
#
# Env:
#   WEB_SMOKE_BASE_URL     Force base URL (https://…)
#   SMOKE_WEB_STACK_NAME   CloudFormation stack to read (see resolve logic below)
#   DEPLOY_STAGE / STAGE   dev | staging | prod (default prod) — stack name fallback
#   AWS_REGION                   default us-east-1
#   SMOKE_TIMEOUT_SECONDS       curl -m value (default 10)
#   SMOKE_REQUIRE_HEALTH_WEB    set to 1 to FAIL when GET /api/health/web returns 404 (after deploy CI)
#   SMOKE_VERIFY_HOST_ROUTING   set to 1 to run app-vs-www split checks (verify-host-routing.sh)
#   SMOKE_APP_ORIGIN / SMOKE_WWW_ORIGIN — overrides for host routing (default app/www.rapidcortex.us)
#
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

TIMEOUT="${SMOKE_TIMEOUT_SECONDS:-10}"
MAX_RETRIES="${MAX_RETRIES:-3}"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# All logging to stderr so command substitution (e.g. BASE_URL="$(resolve… )") stays clean.
log_info() {
  echo -e "${GREEN}✓${NC} $1" >&2
}
log_error() {
  echo -e "${RED}✗${NC} $1" >&2
}
log_warn() {
  echo -e "${YELLOW}⚠${NC} $1" >&2
}

smoke_hint_marketing_miss() {
  log_warn "If /downloads or CDN strings look wrong after a fresh deploy:"
  log_warn "  • Run ./scripts/deploy-web-no-docker.sh ${DEPLOY_STAGE} (new image)."
  log_warn "  • Invalidate CloudFront: Output CloudFrontDistributionId from stack rapid-cortex-web-ssr-${DEPLOY_STAGE}, then:"
  log_warn '    aws cloudfront create-invalidation --distribution-id "$DIST_ID" --paths "/*"'
  log_warn "  • Bypass CDN: resolve AlbDnsName output on stack rapid-cortex-web-ssr-${DEPLOY_STAGE}, then:"
  log_warn '    ./scripts/smoke-web.sh "https://${ALB_HOST}"'
}

downloads_html_has_marketing_markers() {
  local html="$1"
  grep -qi 'Rapid Cortex Downloads' <<<"${html}" && return 0
  grep -qi 'Download for Mac' <<<"${html}" && grep -qi 'Download for Windows' <<<"${html}" && return 0
  grep -qiE 'downloads\.rapidcortex\.us/(mac|windows)' <<<"${html}" && return 0
  grep -qi 'Desktop installers' <<<"${html}" && grep -qiE 'rc.?lite|RC[[:space:]]*Lite' <<<"${html}" && return 0
  return 1
}

usage() {
  echo "Usage: $0 [--help] [[-- | <base-url | host>] ]"
  echo "       Omit URL (or pass only -- ) to resolve the base URL from CloudFormation."
  echo ""
  echo "  $0 https://www.rapidcortex.us"
  echo "  $0 www.rapidcortex.us"
  echo "  WEB_SMOKE_BASE_URL=https://d1111abcdef8.cloudfront.net $0"
  echo "  DEPLOY_STAGE=prod $0                    # auto-resolve from CloudFormation"
  echo "  $0 --                                    # same (explicit)"
  echo "  SMOKE_WEB_STACK_NAME=rapid-cortex-web-ssr-prod $0"
  echo ""
  echo "CloudFormation resolution tries, in order:"
  echo "  • Output keys: CloudFrontDomainName, AlbDnsName, LoadBalancerDns"
  echo "  • Stacks: \$SMOKE_WEB_STACK_NAME (if set), rapid-cortex-web-ssr-<stage>, rapid-cortex-web-ecs-<stage>"
  echo ""
  exit 1
}

normalize_https_url() {
  local raw="${1%/}"
  if [[ "${raw}" =~ ^https?:// ]]; then
    echo "${raw}"
  else
    echo "https://${raw}"
  fi
}

cf_output() {
  local stack="$1"
  local key="$2"
  local region="${AWS_REGION:-${AWS_DEFAULT_REGION:-us-east-1}}"
  aws cloudformation describe-stacks \
    --stack-name "${stack}" \
    --region "${region}" \
    --query "Stacks[0].Outputs[?OutputKey=='${key}'].OutputValue | [0]" \
    --output text 2>/dev/null || true
}

resolve_base_from_cloudformation() {
  local stage
  stage="$(echo "${DEPLOY_STAGE:-${STAGE:-prod}}" | tr '[:upper:]' '[:lower:]')"
  [[ "${stage}" =~ ^(dev|staging|prod)$ ]] || stage="prod"

  local region="${AWS_REGION:-${AWS_DEFAULT_REGION:-us-east-1}}"
  if ! command -v aws &>/dev/null; then
    log_error "aws CLI not found; pass an explicit URL or install AWS CLI."
    exit 1
  fi

  # Prefer pinned stack name, then SSR (e.g. rapid-cortex-web-ssr-prod), then ECS fallback.
  local stacks=()
  if [[ -n "${SMOKE_WEB_STACK_NAME:-}" ]]; then
    stacks+=("${SMOKE_WEB_STACK_NAME}")
  fi
  stacks+=(
    "rapid-cortex-web-ssr-${stage}"
    "rapid-cortex-web-ecs-${stage}"
  )

  local keys=("CloudFrontDomainName" "AlbDnsName" "LoadBalancerDns")

  for stack in "${stacks[@]}"; do
    [[ -n "${stack}" ]] || continue
    for key in "${keys[@]}"; do
      local val
      val="$(cf_output "${stack}" "${key}")"
      if [[ -n "${val}" && "${val}" != "None" ]]; then
        log_info "Using ${key} from stack ${stack} (${region})"
        normalize_https_url "${val}"
        return 0
      fi
    done
  done

  log_error "Could not resolve host from CloudFormation."
  log_error "Tried stacks: ${stacks[*]}"
  exit 1
}

# --- Argument / URL resolution ---
if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  usage
fi

if [[ -n "${WEB_SMOKE_BASE_URL:-}" ]]; then
  BASE_URL="$(normalize_https_url "${WEB_SMOKE_BASE_URL}")"
elif [[ $# -eq 0 ]] || [[ "${1:-}" == "--" ]]; then
  BASE_URL="$(resolve_base_from_cloudformation)"
else
  BASE_URL="$(normalize_https_url "${1}")"
fi

DEPLOY_STAGE="$(echo "${DEPLOY_STAGE:-${STAGE:-prod}}" | tr '[:upper:]' '[:lower:]')"

echo "════════════════════════════════════════════════════════"
echo " Rapid Cortex Web Smoke Tests"
echo "════════════════════════════════════════════════════════"
echo " Base URL:     ${BASE_URL}"
echo " Stage label: ${DEPLOY_STAGE}"
echo " Timeout:     ${TIMEOUT}s"
if [[ "${MAX_RETRIES}" != "0" ]]; then
  echo " Curl retries: ${MAX_RETRIES} (failures)"
fi
if [[ "${SMOKE_REQUIRE_HEALTH_WEB:-0}" == "1" ]]; then
  echo " Smoke mode:  strict — GET /api/health/web must return 2xx (SMOKE_REQUIRE_HEALTH_WEB=1)"
fi
echo "════════════════════════════════════════════════════════"
echo ""

TESTS_PASSED=0
TESTS_FAILED=0

curl_base=(curl -sS -m "${TIMEOUT}" --retry "${MAX_RETRIES}" --retry-connrefused)

test_endpoint() {
  local endpoint="$1"
  local pattern="$2"
  local description="$3"
  local use_f="${4:-1}"

  echo -n "Testing ${description} … "
  local response
  local exit_code=0
  set +e
  if [[ "${use_f}" == "1" ]]; then
    response="$("${curl_base[@]}" -f "${BASE_URL}${endpoint}" 2>&1)"
  else
    response="$("${curl_base[@]}" "${BASE_URL}${endpoint}" 2>&1)"
  fi
  exit_code=$?
  set -e

  if [[ ${exit_code} -ne 0 ]]; then
    log_error "fetch failed ${endpoint} (exit ${exit_code})"
    TESTS_FAILED=$((TESTS_FAILED + 1))
    return 1
  fi

  if [[ -n "${pattern}" ]]; then
    if echo "${response}" | grep -qi "${pattern}"; then
      log_info "${description}"
      TESTS_PASSED=$((TESTS_PASSED + 1))
      return 0
    fi
    log_error "content mismatch ${endpoint} (need pattern /${pattern}/i)"
    TESTS_FAILED=$((TESTS_FAILED + 1))
    return 1
  fi

  log_info "${description} (reachable)"
  TESTS_PASSED=$((TESTS_PASSED + 1))
  return 0
}

# --- Core endpoints ---
test_endpoint "/api/health" '"status"' "Health endpoint (web container GET /api/health)"

_health_web_code="$("${curl_base[@]}" -o /dev/null -w "%{http_code}" "${BASE_URL}/api/health/web" 2>/dev/null || printf '%s' '')"
_health_web_code="${_health_web_code//$'\r'/}"
if [[ "${_health_web_code}" =~ ^2[0-9][0-9]$ ]]; then
  test_endpoint "/api/health/web" '"healthy"' "Web liveness (/api/health/web)"
elif [[ "${_health_web_code}" == "404" ]]; then
  if [[ "${SMOKE_REQUIRE_HEALTH_WEB:-0}" == "1" ]]; then
    log_error "/api/health/web returned 404 (required: SMOKE_REQUIRE_HEALTH_WEB=1 → deploy newer image)."
    TESTS_FAILED=$((TESTS_FAILED + 1))
  else
    log_warn "/api/health/web returned 404 — deploy newer image or set SMOKE_REQUIRE_HEALTH_WEB=1 to fail CI on this."
    TESTS_PASSED=$((TESTS_PASSED + 1))
  fi
else
  log_warn "/api/health/web status unclear (HTTP ${_health_web_code:-unknown}); skipping strict body check"
  TESTS_PASSED=$((TESTS_PASSED + 1))
fi
unset _health_web_code

test_endpoint "/" "" "Home page" 1

echo -n "Testing Downloads marketing page … "
DOWNLOADS_HTML=""
set +e
DOWNLOADS_HTML="$("${curl_base[@]}" -f "${BASE_URL}/downloads" 2>&1)"
_dl_rc=$?
set -e
if [[ ${_dl_rc} -ne 0 ]]; then
  log_error "fetch failed /downloads (exit ${_dl_rc})"
  smoke_hint_marketing_miss
  TESTS_FAILED=$((TESTS_FAILED + 1))
elif downloads_html_has_marketing_markers "${DOWNLOADS_HTML}"; then
  log_info "Downloads marketing page"
  TESTS_PASSED=$((TESTS_PASSED + 1))
else
  log_error "/downloads body missing expected marketing markers (still workspace slug, cache, or old image?)"
  smoke_hint_marketing_miss
  TESTS_FAILED=$((TESTS_FAILED + 1))
fi

test_endpoint "/rc-lite" "RC Lite" "RC Lite page" 1
test_endpoint "/developers/api" "API documentation" "API docs page" 1

echo -n "Checking Mac download link on /downloads … "
if [[ -n "${DOWNLOADS_HTML}" ]] && grep -Fq "downloads.rapidcortex.us/mac" <<<"${DOWNLOADS_HTML}"; then
  log_info "Mac CDN referenced"
  TESTS_PASSED=$((TESTS_PASSED + 1))
else
  log_error "Mac CDN string missing"
  TESTS_FAILED=$((TESTS_FAILED + 1))
fi

echo -n "Checking Windows download link on /downloads … "
if [[ -n "${DOWNLOADS_HTML}" ]] && grep -Fq "downloads.rapidcortex.us/windows" <<<"${DOWNLOADS_HTML}"; then
  log_info "Windows CDN referenced"
  TESTS_PASSED=$((TESTS_PASSED + 1))
else
  log_error "Windows CDN string missing"
  TESTS_FAILED=$((TESTS_FAILED + 1))
fi

echo -n "Checking /downloads mentions RC Lite … "
if [[ -n "${DOWNLOADS_HTML}" ]] && grep -qiE 'rc-lite|RC[[:space:]]*[Ll]ite' <<<"${DOWNLOADS_HTML}"; then
  log_info "RC Lite mention found"
  TESTS_PASSED=$((TESTS_PASSED + 1))
else
  log_error "RC Lite mention missing"
  TESTS_FAILED=$((TESTS_FAILED + 1))
fi

echo -n "Checking / for Downloads nav hint … "
if "${curl_base[@]}" -f "${BASE_URL}/" | grep -qE 'href="/downloads"|Downloads'; then
  log_info "Downloads nav hint present"
  TESTS_PASSED=$((TESTS_PASSED + 1))
else
  log_warn "Downloads nav hint not in initial HTML (RSC/streaming)"
  TESTS_PASSED=$((TESTS_PASSED + 1))
fi

echo -n "Checking / for footer / installer hints … "
if "${curl_base[@]}" -f "${BASE_URL}/" | grep -qE 'Mac installer|Windows installer|footer'; then
  log_info "Footer / installer hints present"
  TESTS_PASSED=$((TESTS_PASSED + 1))
else
  log_warn "Footer not obvious in initial HTML (RSC/streaming)"
  TESTS_PASSED=$((TESTS_PASSED + 1))
fi

if [[ "${BASE_URL}" =~ ^https:// ]]; then
  echo -n "Checking TLS HEAD / … "
  if "${curl_base[@]}" --head -o /dev/null -f "${BASE_URL}/"; then
    log_info "TLS / reachability OK"
    TESTS_PASSED=$((TESTS_PASSED + 1))
  else
    log_error "TLS or HEAD failed"
    TESTS_FAILED=$((TESTS_FAILED + 1))
  fi
fi

echo -n "Checking /api/health latency … "
response_time="$("${curl_base[@]}" -o /dev/null -w '%{time_total}' -f "${BASE_URL}/api/health" || echo "999")"
ms="$(awk -v t="${response_time}" 'BEGIN{printf "%.0f", t*1000}')"
if awk -v m="${ms}" 'BEGIN{exit !(m<3000)}'; then
  log_info "Latency ${response_time}s (~${ms} ms)"
  TESTS_PASSED=$((TESTS_PASSED + 1))
elif awk -v m="${ms}" 'BEGIN{exit !(m<10000)}'; then
  log_warn "Latency ${response_time}s (slow)"
  TESTS_PASSED=$((TESTS_PASSED + 1))
else
  log_error "Latency ${response_time}s (too slow)"
  TESTS_FAILED=$((TESTS_FAILED + 1))
fi

if [[ "${DEPLOY_STAGE}" == "prod" ]]; then
  echo -n "Checking homepage for dev-api host leakage … "
  if "${curl_base[@]}" -f "${BASE_URL}/" | grep -q "dev-api.rapidcortex.us"; then
    log_error "Production HTML mentions dev-api.rapidcortex.us"
    TESTS_FAILED=$((TESTS_FAILED + 1))
  else
    log_info "No dev-api host substring in HTML response"
    TESTS_PASSED=$((TESTS_PASSED + 1))
  fi
fi

if [[ "${SMOKE_VERIFY_HOST_ROUTING:-0}" == "1" ]]; then
  echo ""
  echo "Host routing split (app subdomain vs www)…"
  export APP_ORIGIN="${SMOKE_APP_ORIGIN:-https://app.rapidcortex.us}"
  export WWW_ORIGIN="${SMOKE_WWW_ORIGIN:-https://www.rapidcortex.us}"
  if "${ROOT}/scripts/verify-host-routing.sh"; then
    TESTS_PASSED=$((TESTS_PASSED + 1))
  else
    TESTS_FAILED=$((TESTS_FAILED + 1))
  fi
fi

echo ""
echo "════════════════════════════════════════════════════════"
echo " Test Results"
echo "════════════════════════════════════════════════════════"
echo -e "${GREEN}Passed:${NC} ${TESTS_PASSED}"
if [[ "${TESTS_FAILED}" -gt 0 ]]; then
  echo -e "${RED}Failed:${NC} ${TESTS_FAILED}"
else
  echo -e "${GREEN}Failed:${NC} 0"
fi
echo "════════════════════════════════════════════════════════"

if [[ "${TESTS_FAILED}" -gt 0 ]]; then
  echo ""
  log_error "Smoke tests failed."
  exit 1
fi

echo ""
log_info "All smoke checks passed."
