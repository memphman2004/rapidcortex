#!/usr/bin/env bash
set -euo pipefail
# Emit apps/web environment suggestions from CloudFormation stack outputs.
# Usage: ./scripts/print-stack-outputs-for-web.sh [dev|staging|prod|pilot] [region]
# Requires: aws CLI

STAGE="${1:-dev}"
REGION="${2:-${AWS_REGION:-us-east-1}}"
STACK_NAME="rapid-cortex-${STAGE}"

if ! command -v aws >/dev/null 2>&1; then
  echo "aws CLI is required" >&2
  exit 1
fi

get_output() {
  local key="$1"
  aws cloudformation describe-stacks \
    --region "$REGION" \
    --stack-name "$STACK_NAME" \
    --query "Stacks[0].Outputs[?OutputKey=='${key}'].OutputValue | [0]" \
    --output text 2>/dev/null || true
}

HTTP_API_URL="$(get_output HttpApiUrl)"
HTTP_API_URL_2="$(get_output HttpApi2Url)"
HTTP_API_URL_3="$(get_output HttpApi3Url)"
HTTP_API_URL_4="$(get_output HttpApi4Url)"
HTTP_API_URL_5="$(get_output HttpApi5Url)"
API_CUSTOM_DOMAIN_URL="$(get_output ApiCustomDomainUrl)"
USER_POOL_ID="$(get_output UserPoolId)"
USER_POOL_CLIENT_ID="$(get_output UserPoolClientId)"
COGNITO_ISSUER="$(get_output CognitoIssuer)"
COGNITO_HOSTED_UI="$(get_output CognitoHostedUiBase)"
WWW_URL="$(get_output WwwDomainUrl)"
APP_DOMAIN_URL="$(get_output AppDomainUrl)"
ADMIN_DOMAIN_URL="$(get_output AdminDomainUrl)"
MARKETING_DOMAIN_URL="$(get_output MarketingDomainUrl)"
SELF_SIGNUP_AGENCY="$(get_output SelfSignupDefaultAgencyIdValue)"
DEPLOY_STAGE="$(get_output DeploymentStage)"

if [[ -z "$HTTP_API_URL" || "$HTTP_API_URL" == "None" ]]; then
  echo "Stack ${STACK_NAME} not found or HttpApiUrl output missing in ${REGION}." >&2
  exit 1
fi

API_BASE="$HTTP_API_URL"
if [[ -n "$API_CUSTOM_DOMAIN_URL" && "$API_CUSTOM_DOMAIN_URL" != "None" ]]; then
  API_BASE="$API_CUSTOM_DOMAIN_URL"
fi

SITE_URL="$WWW_URL"
if [[ -z "$SITE_URL" || "$SITE_URL" == "None" ]]; then
  SITE_URL="http://localhost:3000"
fi

APP_ENV="development"
case "${DEPLOY_STAGE:-dev}" in
  dev) APP_ENV="development" ;;
  staging) APP_ENV="staging" ;;
  prod) APP_ENV="production" ;;
  pilot) APP_ENV="production" ;;
esac

# Comma-separated https origins for Next.js CSRF allowlist (browser Origin must match one of these).
# POSIX-friendly (no bash 4 associative arrays — macOS /bin/bash is often 3.2).
ORIGIN_CSV=""
origin_already_in_csv() {
  local needle="$1"
  [[ -z "$needle" ]] && return 1
  case ",${ORIGIN_CSV}," in
    *",${needle},"*) return 0 ;;
    *) return 1 ;;
  esac
}
append_origin_csv() {
  local url="${1:-}"
  [[ -n "$url" && "$url" != "None" ]] || return 0
  if [[ "$url" =~ ^https?://[^/]+ ]]; then
    local o="${BASH_REMATCH[0]}"
    if ! origin_already_in_csv "$o"; then
      if [[ -n "$ORIGIN_CSV" ]]; then ORIGIN_CSV+=","
      fi
      ORIGIN_CSV+="$o"
    fi
  fi
}
append_origin_csv "$WWW_URL"
append_origin_csv "$APP_DOMAIN_URL"
append_origin_csv "$ADMIN_DOMAIN_URL"
append_origin_csv "$MARKETING_DOMAIN_URL"
append_origin_csv "$SITE_URL"

COGNITO_GENERATES_SECRET="unknown"
if [[ -n "$USER_POOL_ID" && "$USER_POOL_ID" != "None" && -n "$USER_POOL_CLIENT_ID" && "$USER_POOL_CLIENT_ID" != "None" ]]; then
  COGNITO_GENERATES_SECRET="$(
    aws cognito-idp describe-user-pool-client \
      --region "$REGION" \
      --user-pool-id "$USER_POOL_ID" \
      --client-id "$USER_POOL_CLIENT_ID" \
      --query "UserPoolClient.GenerateSecret" \
      --output text 2>/dev/null || echo "unknown"
  )"
fi

echo ""
echo "# -----------------------------------------------------------------------------"
echo "# Rapid Cortex — paste into apps/web/.env.local (or your host env UI)"
echo "# Stack: ${STACK_NAME}  Region: ${REGION}"
echo "# Generated: $(date -u +%Y-%m-%dT%H:%MZ)"
echo "# -----------------------------------------------------------------------------"
echo ""
echo "NEXT_PUBLIC_SITE_URL=${SITE_URL}"
echo "NEXT_PUBLIC_DEFAULT_JURISDICTION_SLUG=demo"
echo ""
echo "# --- Cognito (must match this stack's pool + app client) ---"
echo "NEXT_PUBLIC_COGNITO_USER_POOL_ID=${USER_POOL_ID}"
echo "NEXT_PUBLIC_COGNITO_CLIENT_ID=${USER_POOL_CLIENT_ID}"
echo "NEXT_PUBLIC_COGNITO_REGION=${REGION}"
echo ""
echo "# --- Server-side Cognito (Next /api/auth/* route handlers; mirror NEXT_PUBLIC_* above) ---"
echo "COGNITO_USER_POOL_ID=${USER_POOL_ID}"
echo "COGNITO_CLIENT_ID=${USER_POOL_CLIENT_ID}"
echo "COGNITO_REGION=${REGION}"
echo ""
echo "# --- CSRF Origin allowlist (required in production if you rely on env-only allowlist) ---"
if [[ -n "$ORIGIN_CSV" ]]; then
  echo "APP_ALLOWED_ORIGINS=${ORIGIN_CSV}"
else
  echo "# APP_ALLOWED_ORIGINS=(no stack URLs parsed — set manually to your deployed https origin(s))"
fi
echo ""
echo "# --- API: pick ONE pattern ---"
echo "# Direct browser → API (JWT in JS; less common with cookie sign-in):"
echo "# NEXT_PUBLIC_API_BASE=${API_BASE}"
echo ""
echo "# Recommended: same-origin BFF proxy (cookies; no token in browser JS)"
echo "NEXT_PUBLIC_AUTH_PROXY=1"
echo "API_UPSTREAM_BASE=${API_BASE}"
if [[ -n "${HTTP_API_URL_2:-}" && "$HTTP_API_URL_2" != "None" ]]; then
  echo "API_UPSTREAM_BASE_2=${HTTP_API_URL_2}"
  echo "NEXT_PUBLIC_API_BASE_2=${HTTP_API_URL_2}"
fi
if [[ -n "${HTTP_API_URL_3:-}" && "$HTTP_API_URL_3" != "None" ]]; then
  echo "API_UPSTREAM_BASE_3=${HTTP_API_URL_3}"
  echo "NEXT_PUBLIC_API_BASE_3=${HTTP_API_URL_3}"
fi
if [[ -n "${HTTP_API_URL_4:-}" && "$HTTP_API_URL_4" != "None" ]]; then
  echo "API_UPSTREAM_BASE_4=${HTTP_API_URL_4}"
  echo "NEXT_PUBLIC_API_BASE_4=${HTTP_API_URL_4}"
fi
if [[ -n "${HTTP_API_URL_5:-}" && "$HTTP_API_URL_5" != "None" ]]; then
  echo "API_UPSTREAM_BASE_5=${HTTP_API_URL_5}"
  echo "NEXT_PUBLIC_API_BASE_5=${HTTP_API_URL_5}"
fi
echo ""
echo "# --- Environment badge (matches stack DeploymentStage) ---"
echo "NEXT_PUBLIC_APP_ENV=${APP_ENV}"
echo ""
echo "# --- Desktop native clients (macOS Secrets.plist + Windows appsettings) ---"
echo "# ./scripts/sync-desktop-config.sh ${STAGE}"
echo ""
echo "# --- CLI / smoke tests (G3 script, pilot-smoke) — API Lambda HTTP base ---"
echo "BASE_URL=${API_BASE}"
echo "# G3_WEB_URL=${SITE_URL}"
echo ""
echo "# --- Cognito Hosted UI base (optional; app uses custom /api/auth/* routes by default) ---"
if [[ -n "$COGNITO_HOSTED_UI" && "$COGNITO_HOSTED_UI" != "None" ]]; then
  echo "# NEXT_PUBLIC_COGNITO_HOSTED_UI_BASE=${COGNITO_HOSTED_UI}"
fi
if [[ -n "$COGNITO_ISSUER" && "$COGNITO_ISSUER" != "None" ]]; then
  echo "# Issuer (JWT): ${COGNITO_ISSUER}"
fi
echo ""
echo "# --- Post-deploy: create DynamoDB agency row for self-signup placeholder ---"
echo "# SelfSignupDefaultAgencyId (stack output): ${SELF_SIGNUP_AGENCY:-unknown}"
echo "# See docs/COGNITO_SELF_SIGNUP.md (if present in repo)."
echo ""
echo "# --- Cognito app client (from AWS CLI; no secrets printed) ---"
echo "# GenerateSecret (if \"true\", set COGNITO_CLIENT_SECRET server-side from your secret store): ${COGNITO_GENERATES_SECRET}"
echo ""
