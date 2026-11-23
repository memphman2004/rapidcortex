#!/usr/bin/env bash
# =============================================================================
# scripts/ensure-api-routes.sh
#
# Idempotent route guardian — recreates any API Gateway routes that are
# missing from the live APIs after a CloudFormation deploy or rollback.
#
# WHY THIS EXISTS:
#   Several feature stacks (business-cards, nexiq-signals) register routes on
#   CloudFormation resource IDs that have drifted from the live API.  Every
#   time `deploy.sh` runs a main-stack update + rollback, AppSamStackV2 is
#   re-applied and out-of-band integrations/routes are wiped.  This script is
#   the last step in deploy.sh; it re-creates any missing routes so the
#   feature is ALWAYS live after a deploy, regardless of rollback state.
#
# USAGE (called automatically by deploy.sh):
#   bash scripts/ensure-api-routes.sh [dev|staging|prod]
#
# STANDALONE:
#   export AWS_PROFILE=rapid-cortex
#   bash scripts/ensure-api-routes.sh dev
# =============================================================================
set -euo pipefail

STAGE="${1:-${DEPLOYMENT_STAGE:-dev}}"
PROFILE="${AWS_PROFILE:-rapid-cortex}"
REGION="${AWS_REGION:-us-east-1}"

# ---------------------------------------------------------------------------
# API IDs per stage
# ---------------------------------------------------------------------------
case "${STAGE}" in
  dev)
    PRIMARY_API="k26yw4o3xk"   # rapid-cortex-dev-AppSamStackV2 (stack 1)
    SAM3_API="tbr4zvjlk5"      # rapid-cortex-dev-AppSam3Stack  (stack 3)
    ;;
  staging)
    # Update these after first staging deploy outputs are confirmed
    PRIMARY_API="${STAGING_PRIMARY_API:-}"
    SAM3_API="${STAGING_SAM3_API:-}"
    ;;
  prod)
    PRIMARY_API="${PROD_PRIMARY_API:-}"
    SAM3_API="${PROD_SAM3_API:-}"
    ;;
  *)
    echo "ensure-api-routes: unknown stage '${STAGE}'" >&2
    exit 1
    ;;
esac

if [[ -z "${PRIMARY_API}" ]]; then
  echo "ensure-api-routes: PRIMARY_API is not set for stage '${STAGE}' — skipping." >&2
  exit 0
fi

echo ""
echo "════════════════════════════════════════════════════════"
echo " Route guardian — ensuring required API routes exist"
echo " Stage: ${STAGE} | Primary API: ${PRIMARY_API}"
echo "════════════════════════════════════════════════════════"

ERRORS=0

# ---------------------------------------------------------------------------
# Helper: get the JWT authorizer ID for a given API
# ---------------------------------------------------------------------------
get_authorizer() {
  local api="$1"
  aws apigatewayv2 get-authorizers \
    --profile "${PROFILE}" --region "${REGION}" \
    --api-id "${api}" \
    --query "Items[?AuthorizerType=='JWT'] | [0].AuthorizerId" \
    --output text 2>/dev/null || echo ""
}

# ---------------------------------------------------------------------------
# Helper: check if a route with this exact RouteKey already exists
# Returns the RouteId if found, empty string if not
# ---------------------------------------------------------------------------
# BUG FIX: `get-routes` auto-paginates — each page that returns no match emits
# "None" via `--output text`, and tr concatenates them into "NoneNoneNone..."
# which is non-empty and passes the `[[ -n "$existing" ]]` check, producing a
# false-positive "✓ exists".  Avoid by fetching all routes as JSON once and
# doing an exact RouteKey match in Python (route key passed via env var to
# avoid shell escaping issues with curly braces in proxy+ path params).
find_route() {
  local api="$1" route_key="$2"
  FIND_ROUTE_KEY="${route_key}" aws apigatewayv2 get-routes \
    --profile "${PROFILE}" --region "${REGION}" \
    --api-id "${api}" \
    --output json 2>/dev/null \
  | python3 -c "
import sys, json, os
key = os.environ.get('FIND_ROUTE_KEY', '')
data = json.load(sys.stdin)
for r in data.get('Items', []):
    if r.get('RouteKey') == key:
        print(r.get('RouteId', ''))
        sys.exit(0)
" 2>/dev/null | tr -d '\t\n' || echo ""
}

# ---------------------------------------------------------------------------
# Helper: get or create an integration for a Lambda ARN
# Returns the IntegrationId
# (Uses Python to avoid the same pagination false-positive bug as find_route)
# ---------------------------------------------------------------------------
ensure_integration() {
  local api="$1" lambda_arn="$2"
  local uri="arn:aws:apigateway:${REGION}:lambda:path/2015-03-31/functions/${lambda_arn}/invocations"

  # Check if integration already exists for this Lambda (Python for pagination safety)
  local existing
  existing=$(FIND_INTEG_URI="${uri}" aws apigatewayv2 get-integrations \
    --profile "${PROFILE}" --region "${REGION}" \
    --api-id "${api}" \
    --output json 2>/dev/null \
  | python3 -c "
import sys, json, os
uri = os.environ.get('FIND_INTEG_URI', '')
data = json.load(sys.stdin)
for r in data.get('Items', []):
    if r.get('IntegrationUri') == uri:
        print(r.get('IntegrationId', ''))
        sys.exit(0)
" 2>/dev/null | tr -d '\t\n' || echo "")

  if [[ -n "${existing}" && "${existing}" != "None" ]]; then
    echo "${existing}"
    return
  fi

  # Create a new integration
  aws apigatewayv2 create-integration \
    --profile "${PROFILE}" --region "${REGION}" \
    --api-id "${api}" \
    --integration-type AWS_PROXY \
    --integration-uri "${uri}" \
    --payload-format-version "2.0" \
    --query 'IntegrationId' \
    --output text 2>/dev/null | tr -d '\t\n'
}

# ---------------------------------------------------------------------------
# Helper: ensure a single route exists
# ---------------------------------------------------------------------------
ensure_route() {
  local api="$1" route_key="$2" auth_type="$3" authorizer_id="$4" integ_id="$5"

  local existing
  existing=$(find_route "${api}" "${route_key}")

  if [[ -n "${existing}" && "${existing}" != "None" ]]; then
    echo "  ✓ exists  ${route_key}"
    return 0
  fi

  local args=(
    --profile "${PROFILE}" --region "${REGION}"
    --api-id "${api}"
    --route-key "${route_key}"
    --authorization-type "${auth_type}"
    --target "integrations/${integ_id}"
  )
  if [[ "${auth_type}" == "JWT" && -n "${authorizer_id}" ]]; then
    args+=(--authorizer-id "${authorizer_id}")
  fi

  local new_id
  new_id=$(aws apigatewayv2 create-route "${args[@]}" \
    --query 'RouteId' --output text 2>/dev/null | tr -d '\t\n' || echo "FAILED")

  if [[ "${new_id}" == "FAILED" || -z "${new_id}" ]]; then
    echo "  ✗ FAILED  ${route_key}" >&2
    ERRORS=$(( ERRORS + 1 ))
  else
    echo "  ✚ created ${route_key} → ${new_id}"
  fi
}

# ===========================================================================
# SECTION 1: Digital Business Cards  (PRIMARY_API)
# ===========================================================================
echo ""
echo "── Business Cards (${PRIMARY_API}) ──────────────────────────────────"

BIZ_AUTH=$(get_authorizer "${PRIMARY_API}")
BIZ_LAMBDA_ARN="arn:aws:lambda:${REGION}:158961537080:function:rapid-cortex-${STAGE}-AppSamBu-BusinessCardsHttpFunctio-TY3Aho55GQSM"
PUB_LAMBDA_ARN="arn:aws:lambda:${REGION}:158961537080:function:rapid-cortex-${STAGE}-AppSamBu-BusinessCardsPublicHttpF-J4DEFX49prMo"

# Look up actual function ARNs (pagination-safe: list-functions paginates; use
# Python to scan all pages for the matching function name prefix).
BIZ_FN=$(FIND_FN_PREFIX="BusinessCardsHttpFunctio" FIND_FN_STAGE="${STAGE}" \
  aws lambda list-functions \
  --profile "${PROFILE}" --region "${REGION}" \
  --output json 2>/dev/null \
| python3 -c "
import sys, json, os
prefix = os.environ.get('FIND_FN_PREFIX', '')
stage  = os.environ.get('FIND_FN_STAGE', '')
data = json.load(sys.stdin)
for f in data.get('Functions', []):
    n = f.get('FunctionName', '')
    if prefix in n and ('rapid-cortex-' + stage) in n:
        print(f.get('FunctionArn', ''))
        sys.exit(0)
" 2>/dev/null | tr -d '\t\n' || echo "")
PUB_FN=$(FIND_FN_PREFIX="BusinessCardsPublicHttpF" FIND_FN_STAGE="${STAGE}" \
  aws lambda list-functions \
  --profile "${PROFILE}" --region "${REGION}" \
  --output json 2>/dev/null \
| python3 -c "
import sys, json, os
prefix = os.environ.get('FIND_FN_PREFIX', '')
stage  = os.environ.get('FIND_FN_STAGE', '')
data = json.load(sys.stdin)
for f in data.get('Functions', []):
    n = f.get('FunctionName', '')
    if prefix in n and ('rapid-cortex-' + stage) in n:
        print(f.get('FunctionArn', ''))
        sys.exit(0)
" 2>/dev/null | tr -d '\t\n' || echo "")

if [[ -z "${BIZ_FN}" || "${BIZ_FN}" == "None" ]]; then
  echo "  ⚠ BusinessCardsHttpFunction not found — skipping business-cards routes" >&2
else
  BIZ_INTEG=$(ensure_integration "${PRIMARY_API}" "${BIZ_FN}")
  PUB_INTEG=$(ensure_integration "${PRIMARY_API}" "${PUB_FN}")

  ensure_route "${PRIMARY_API}" "ANY /api/business-cards/{proxy+}"          JWT  "${BIZ_AUTH}" "${BIZ_INTEG}"
  ensure_route "${PRIMARY_API}" "ANY /api/admin/business-cards"              JWT  "${BIZ_AUTH}" "${BIZ_INTEG}"
  ensure_route "${PRIMARY_API}" "ANY /api/admin/business-cards/{proxy+}"    JWT  "${BIZ_AUTH}" "${BIZ_INTEG}"
  ensure_route "${PRIMARY_API}" "ANY /api/admin/nfc-cards"                   JWT  "${BIZ_AUTH}" "${BIZ_INTEG}"
  ensure_route "${PRIMARY_API}" "ANY /api/admin/nfc-cards/{proxy+}"         JWT  "${BIZ_AUTH}" "${BIZ_INTEG}"
  ensure_route "${PRIMARY_API}" "GET /api/admin/analytics/business-cards"   JWT  "${BIZ_AUTH}" "${BIZ_INTEG}"
  ensure_route "${PRIMARY_API}" "ANY /api/public/business-cards/{proxy+}"   NONE ""             "${PUB_INTEG}"
  ensure_route "${PRIMARY_API}" "GET /api/public/c/{cardId}"                NONE ""             "${PUB_INTEG}"
fi

# ===========================================================================
# SECTION 2: NexiQ Signals  (SAM3_API)
# ===========================================================================
if [[ -n "${SAM3_API}" ]]; then
  echo ""
  echo "── NexiQ Signals (${SAM3_API}) ──────────────────────────────────────"

  SIG_AUTH=$(get_authorizer "${SAM3_API}")
  SIG_FN=$(FIND_FN_PREFIX="NexiqSignalsHttpFunction" FIND_FN_STAGE="${STAGE}" \
    aws lambda list-functions \
    --profile "${PROFILE}" --region "${REGION}" \
    --output json 2>/dev/null \
  | python3 -c "
import sys, json, os
prefix = os.environ.get('FIND_FN_PREFIX', '')
stage  = os.environ.get('FIND_FN_STAGE', '')
data = json.load(sys.stdin)
for f in data.get('Functions', []):
    n = f.get('FunctionName', '')
    if prefix in n and ('rapid-cortex-' + stage) in n:
        print(f.get('FunctionArn', ''))
        sys.exit(0)
" 2>/dev/null | tr -d '\t\n' || echo "")

  if [[ -z "${SIG_FN}" || "${SIG_FN}" == "None" ]]; then
    echo "  ⚠ NexiqSignalsHttpFunction not found — skipping signals routes" >&2
  else
    SIG_INTEG=$(ensure_integration "${SAM3_API}" "${SIG_FN}")
    ensure_route "${SAM3_API}" "POST /api/signals"             JWT  "${SIG_AUTH}" "${SIG_INTEG}"
    ensure_route "${SAM3_API}" "GET /api/signals"              JWT  "${SIG_AUTH}" "${SIG_INTEG}"
    ensure_route "${SAM3_API}" "GET /api/signals/{signalId}"   JWT  "${SIG_AUTH}" "${SIG_INTEG}"
  fi
fi

# ===========================================================================
# Summary
# ===========================================================================
echo ""
if [[ "${ERRORS}" -gt 0 ]]; then
  echo "════════════════════════════════════════════════════════"
  echo " ⚠  Route guardian finished with ${ERRORS} error(s)."
  echo "    Some routes may still be missing — check output above."
  echo "════════════════════════════════════════════════════════"
  exit 1
else
  echo "════════════════════════════════════════════════════════"
  echo " ✅ Route guardian complete — all routes verified/created"
  echo "════════════════════════════════════════════════════════"
fi
