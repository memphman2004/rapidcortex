#!/usr/bin/env bash
set -euo pipefail

# Post-deploy API smoke checks for Rapid Cortex SAM stack (HttpApiUrl / Cognito auth).
# Archived from scripts/post-deploy-smoke.sh — use for backend/API validation after sam deploy.
# Web curl smoke: scripts/smoke-web.sh or scripts/post-deploy-smoke.sh
#
# Usage:
#   ./scripts/archive/post-deploy-api-smoke.sh [dev|staging|prod|pilot] [region]
# Example:
#   ./scripts/archive/post-deploy-api-smoke.sh prod us-east-1
#
# Optional authenticated checks (recommended for pilot/staging):
#   export SMOKE_TEST_USERNAME='user@example.com'
#   export SMOKE_TEST_PASSWORD='...'
# Then this script also verifies GET /api/me (200) and GET /api/integration/status (200 for admin-capable users).

STAGE="${1:-dev}"
REGION="${2:-us-east-1}"
STACK_NAME="rapid-cortex-${STAGE}"

require_cmd() {
  local cmd="$1"
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "Missing required command: $cmd" >&2
    exit 1
  fi
}

require_cmd aws
require_cmd curl

echo "==> Loading stack outputs for ${STACK_NAME} (${REGION})"

get_output() {
  local key="$1"
  aws cloudformation describe-stacks \
    --region "$REGION" \
    --stack-name "$STACK_NAME" \
    --query "Stacks[0].Outputs[?OutputKey=='${key}'].OutputValue | [0]" \
    --output text
}

HTTP_API_URL="$(get_output HttpApiUrl)"
API_CUSTOM_DOMAIN_URL="$(get_output ApiCustomDomainUrl)"
USER_POOL_ID="$(get_output UserPoolId)"
USER_POOL_CLIENT_ID="$(get_output UserPoolClientId)"

if [[ -z "$HTTP_API_URL" || "$HTTP_API_URL" == "None" ]]; then
  echo "HttpApiUrl output missing for ${STACK_NAME}" >&2
  exit 1
fi

if [[ -z "$USER_POOL_ID" || "$USER_POOL_ID" == "None" ]]; then
  echo "UserPoolId output missing for ${STACK_NAME}" >&2
  exit 1
fi

if [[ -z "$USER_POOL_CLIENT_ID" || "$USER_POOL_CLIENT_ID" == "None" ]]; then
  echo "UserPoolClientId output missing for ${STACK_NAME}" >&2
  exit 1
fi

echo "==> Outputs"
echo "HttpApiUrl: ${HTTP_API_URL}"
if [[ -n "$API_CUSTOM_DOMAIN_URL" && "$API_CUSTOM_DOMAIN_URL" != "None" ]]; then
  echo "ApiCustomDomainUrl: ${API_CUSTOM_DOMAIN_URL}"
else
  echo "ApiCustomDomainUrl: (not configured)"
fi
echo "UserPoolId: ${USER_POOL_ID}"
echo "UserPoolClientId: ${USER_POOL_CLIENT_ID}"

check_status() {
  local url="$1"
  local expected="$2"
  local label="$3"
  local status
  status="$(curl -sS -o /tmp/rapidcortex-smoke.out -w "%{http_code}" "$url")"
  if [[ "$status" != "$expected" ]]; then
    echo "FAIL ${label}: expected ${expected}, got ${status}" >&2
    echo "Response body:" >&2
    cat /tmp/rapidcortex-smoke.out >&2 || true
    exit 1
  fi
  echo "PASS ${label}: ${status}"
}

echo "==> API checks"
check_status "${HTTP_API_URL}/api/health" "200" "health endpoint"
check_status "${HTTP_API_URL}/api/me" "401" "unauthenticated me endpoint"

if [[ -n "$API_CUSTOM_DOMAIN_URL" && "$API_CUSTOM_DOMAIN_URL" != "None" ]]; then
  check_status "${API_CUSTOM_DOMAIN_URL}/api/health" "200" "custom domain health endpoint"
  check_status "${API_CUSTOM_DOMAIN_URL}/api/me" "401" "custom domain unauthenticated me endpoint"
fi

DEPLOY_STAGE="$(get_output DeploymentStage)"
if [[ -n "$DEPLOY_STAGE" && "$DEPLOY_STAGE" != "None" ]]; then
  echo "DeploymentStage output: ${DEPLOY_STAGE}"
fi

if [[ -n "${SMOKE_TEST_USERNAME:-}" && -n "${SMOKE_TEST_PASSWORD:-}" ]]; then
  echo "==> Authenticated smoke (SMOKE_TEST_USERNAME set)"
  AUTH_JSON="$(aws cognito-idp initiate-auth \
    --region "$REGION" \
    --auth-flow USER_PASSWORD_AUTH \
    --client-id "$USER_POOL_CLIENT_ID" \
    --auth-parameters USERNAME="${SMOKE_TEST_USERNAME}",PASSWORD="${SMOKE_TEST_PASSWORD}" \
    --output json)"
  ID_TOKEN="$(echo "$AUTH_JSON" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d['AuthenticationResult']['IdToken'])")"
  ME_STATUS="$(curl -sS -o /tmp/rapidcortex-smoke-me.out -w "%{http_code}" \
    -H "Authorization: Bearer ${ID_TOKEN}" \
    "${HTTP_API_URL}/api/me")"
  if [[ "$ME_STATUS" != "200" ]]; then
    echo "FAIL authenticated /api/me: expected 200, got ${ME_STATUS}" >&2
    cat /tmp/rapidcortex-smoke-me.out >&2 || true
    exit 1
  fi
  echo "PASS authenticated /api/me: ${ME_STATUS}"
  INT_STATUS="$(curl -sS -o /tmp/rapidcortex-smoke-int.out -w "%{http_code}" \
    -H "Authorization: Bearer ${ID_TOKEN}" \
    "${HTTP_API_URL}/api/integration/status")"
  if [[ "$INT_STATUS" != "200" && "$INT_STATUS" != "403" ]]; then
    echo "FAIL authenticated /api/integration/status: expected 200 or 403, got ${INT_STATUS}" >&2
    cat /tmp/rapidcortex-smoke-int.out >&2 || true
    exit 1
  fi
  echo "PASS authenticated /api/integration/status: ${INT_STATUS} (403 is OK for non-admin roles)"
else
  echo "==> Skipping authenticated smoke (set SMOKE_TEST_USERNAME and SMOKE_TEST_PASSWORD to enable)"
fi

echo "==> Smoke checks completed successfully for ${STACK_NAME}"
