#!/usr/bin/env bash
set -euo pipefail
# Refresh desktop client config (macOS Secrets.plist + Windows appsettings) from CloudFormation outputs.
# Usage: ./scripts/sync-desktop-config.sh [dev|staging|prod|pilot]
#
# Production API lives on stack rapid-cortex-dev (DeploymentStage=dev). Pass dev unless you use another stage.

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
STAGE="${1:-dev}"
REGION="${AWS_REGION:-${AWS_DEFAULT_REGION:-us-east-1}}"
# Do not inherit STACK_NAME from web/ECS env scripts (e.g. rapid-cortex-web-ssr-prod-v2).
unset STACK_NAME
STACK_NAME="rapid-cortex-${STAGE}"

if ! command -v aws >/dev/null 2>&1; then
  echo "aws CLI is required" >&2
  exit 1
fi
if ! command -v jq >/dev/null 2>&1; then
  echo "jq is required (brew install jq)" >&2
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
API_CUSTOM="$(get_output ApiCustomDomainUrl)"
NATIVE_CLIENT="$(get_output NativeUserPoolClientId)"
USER_POOL="$(get_output UserPoolId)"
WWW_URL="$(get_output WwwDomainUrl)"

if [[ -z "$HTTP_API_URL" || "$HTTP_API_URL" == "None" ]]; then
  echo "Stack ${STACK_NAME} missing HttpApiUrl in ${REGION}." >&2
  exit 1
fi

API_BASE="$HTTP_API_URL"
if [[ -n "$API_CUSTOM" && "$API_CUSTOM" != "None" ]]; then
  API_BASE="$API_CUSTOM"
fi

API_BASE_2="${HTTP_API_URL_2:-}"
if [[ -z "$API_BASE_2" || "$API_BASE_2" == "None" ]]; then
  API_BASE_2=""
fi

WEB_BASE="${WWW_URL:-https://www.rapidcortex.us}"
if [[ -z "$WEB_BASE" || "$WEB_BASE" == "None" ]]; then
  WEB_BASE="https://www.rapidcortex.us"
fi

COGNITO_DOMAIN="${COGNITO_DOMAIN:-rapidcortex-${STAGE}-158961537080.auth.${REGION}.amazoncognito.com}"
if [[ -n "$USER_POOL" && "$USER_POOL" != "None" ]]; then
  COGNITO_DOMAIN="$(aws cognito-idp describe-user-pool \
    --region "$REGION" \
    --user-pool-id "$USER_POOL" \
    --query 'UserPool.Domain' \
    --output text 2>/dev/null || echo "")"
  if [[ -n "$COGNITO_DOMAIN" && "$COGNITO_DOMAIN" != "None" ]]; then
    COGNITO_DOMAIN="${COGNITO_DOMAIN}.auth.${REGION}.amazoncognito.com"
  fi
fi

NATIVE_CLIENT="${NATIVE_CLIENT:-}"
if [[ -z "$NATIVE_CLIENT" || "$NATIVE_CLIENT" == "None" ]]; then
  echo "WARN: NativeUserPoolClientId output missing; keeping existing Cognito client id in desktop configs." >&2
fi

MAC_SECRETS="$ROOT/apps/desktop-macos/RapidCortexDesktop/Config/Secrets.plist"
MAC_EXAMPLE="$ROOT/apps/desktop-macos/RapidCortexDesktop/Config/Secrets.example.plist"
MAC_BUNDLED="$ROOT/apps/desktop-macos/RapidCortexDesktop.app/Contents/Resources/Secrets.plist"

update_mac_plist() {
  local file="$1"
  [[ -f "$file" ]] || return 0
  /usr/libexec/PlistBuddy -c "Set :API_BASE_URL ${API_BASE}" "$file" 2>/dev/null \
    || /usr/libexec/PlistBuddy -c "Add :API_BASE_URL string ${API_BASE}" "$file"
  if [[ -n "$API_BASE_2" ]]; then
    /usr/libexec/PlistBuddy -c "Set :API_BASE_URL_2 ${API_BASE_2}" "$file" 2>/dev/null \
      || /usr/libexec/PlistBuddy -c "Add :API_BASE_URL_2 string ${API_BASE_2}" "$file"
  fi
  /usr/libexec/PlistBuddy -c "Set :WEB_APP_BASE_URL ${WEB_BASE}" "$file" 2>/dev/null \
    || /usr/libexec/PlistBuddy -c "Add :WEB_APP_BASE_URL string ${WEB_BASE}" "$file"
  /usr/libexec/PlistBuddy -c "Set :COGNITO_REGION ${REGION}" "$file" 2>/dev/null \
    || /usr/libexec/PlistBuddy -c "Add :COGNITO_REGION string ${REGION}" "$file"
  /usr/libexec/PlistBuddy -c "Set :COGNITO_DOMAIN ${COGNITO_DOMAIN}" "$file" 2>/dev/null \
    || /usr/libexec/PlistBuddy -c "Add :COGNITO_DOMAIN string ${COGNITO_DOMAIN}" "$file"
  if [[ -n "$NATIVE_CLIENT" && "$NATIVE_CLIENT" != "None" ]]; then
    /usr/libexec/PlistBuddy -c "Set :COGNITO_CLIENT_ID ${NATIVE_CLIENT}" "$file" 2>/dev/null \
      || /usr/libexec/PlistBuddy -c "Add :COGNITO_CLIENT_ID string ${NATIVE_CLIENT}" "$file"
  fi
}

update_windows_json() {
  local file="$1"
  [[ -f "$file" ]] || return 0
  local tmp
  tmp="$(mktemp)"
  jq \
    --arg api "$API_BASE" \
    --arg api2 "$API_BASE_2" \
    --arg web "$WEB_BASE" \
    --arg region "$REGION" \
    --arg domain "$COGNITO_DOMAIN" \
    --arg client "$NATIVE_CLIENT" \
    --arg pool "$USER_POOL" \
    '
    .RapidCortex.ApiBaseUrl = $api
    | (if $api2 != "" then .RapidCortex.ApiBaseUrl2 = $api2 else . end)
    | .RapidCortex.WebAppBaseUrl = $web
    | .RapidCortex.Cognito.Region = $region
    | .RapidCortex.Cognito.Domain = $domain
    | (if $client != "" and $client != "None" then .RapidCortex.Cognito.ClientId = $client else . end)
    | (if $pool != "" and $pool != "None" then .RapidCortex.Cognito.UserPoolId = $pool else . end)
    ' "$file" > "$tmp"
  mv "$tmp" "$file"
}

echo "Syncing desktop config from ${STACK_NAME} (${REGION})…"
echo "  API_BASE_URL / ApiBaseUrl:     ${API_BASE}"
echo "  API_BASE_URL_2 / ApiBaseUrl2:  ${API_BASE_2:-<none>}"
echo "  WEB_APP_BASE_URL:              ${WEB_BASE}"
echo "  COGNITO_DOMAIN:                ${COGNITO_DOMAIN}"
echo "  Native client:                 ${NATIVE_CLIENT:-<unchanged>}"

update_mac_plist "$MAC_SECRETS"
update_mac_plist "$MAC_EXAMPLE"
update_mac_plist "$MAC_BUNDLED"

WIN_FILES=(
  "$ROOT/apps/desktop-windows/appsettings.example.json"
  "$ROOT/apps/desktop-windows/src/RapidCortexDesktop.Wpf/appsettings.Production.json"
  "$ROOT/apps/desktop-windows/src/RapidCortexDesktop.Wpf/appsettings.Development.json"
  "$ROOT/apps/desktop-windows/src/RapidCortexDesktop.Wpf/publish/win-x64/appsettings.Production.json"
  "$ROOT/apps/desktop-windows/src/RapidCortexDesktop.Wpf/publish/win-x64/appsettings.Development.json"
)
for f in "${WIN_FILES[@]}"; do
  update_windows_json "$f"
done

echo "Done. Rebuild installers: ./scripts/macos-distribution-build.sh (mac) and dotnet publish on Windows."
