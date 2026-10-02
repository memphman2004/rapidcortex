#!/usr/bin/env bash
# Call Assist Phase 1 — internal-HD deploy
# Run from macOS Terminal (not Cursor agent shell if it is wedged):
#   bash "/Volumes/Mac Mini/Coding Projects/Rapid Cortex/scripts/deploy-call-assist-phase1.sh"
set -euo pipefail

export AWS_PROFILE="${AWS_PROFILE:-rapid-cortex}"
export AWS_REGION="${AWS_REGION:-us-east-1}"
export AWS_DEFAULT_REGION="${AWS_REGION}"
unset HTTP_PROXY HTTPS_PROXY http_proxy https_proxy ALL_PROXY all_proxy no_proxy NO_PROXY || true

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

LOG="${HOME}/.rapid-cortex-sam-build/call-assist-phase1-deploy.log"
mkdir -p "$(dirname "$LOG")"
exec > >(tee -a "$LOG") 2>&1

echo "═══════════════════════════════════════════════════════"
echo " Call Assist Phase 1 deploy"
echo " ROOT=$ROOT"
echo " LOG=$LOG"
echo " $(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo "═══════════════════════════════════════════════════════"

source "$ROOT/scripts/env-api-dev.sh"
export SAM_BUILD_DIR="${SAM_BUILD_DIR:-$HOME/.rapid-cortex-sam-build/current}"
mkdir -p "$SAM_BUILD_DIR"
export SKIP_NPM_INSTALL="${SKIP_NPM_INSTALL:-0}"

echo "▶ Account check"
aws sts get-caller-identity

echo "▶ Ensure GSI2 on call-assist table"
bash "$ROOT/scripts/ensure-call-assist-gsi2.sh" "rapid-cortex-call-assist-dev"

# API resolves rapid-cortex-shared/security from vendor-packs/*.tgz — must refresh
# before tsc or Call Assist Phase 1 symbols are missing.
# shellcheck source=scripts/lib/api-vendor-lock.sh
source "${ROOT}/scripts/lib/api-vendor-lock.sh"
# shellcheck source=scripts/lib/prepare-api-vendor-for-sam.sh
source "${ROOT}/scripts/lib/prepare-api-vendor-for-sam.sh"
rc_acquire_api_vendor_lock
REVERT_API_PKG=0
cleanup_call_assist_deploy() {
  if [[ "${REVERT_API_PKG:-0}" -eq 1 && -f "${ROOT}/apps/api/package.json.pre-call-assist" ]]; then
    echo "▶ Restoring apps/api/package.json from pre-call-assist backup"
    mv "${ROOT}/apps/api/package.json.pre-call-assist" "${ROOT}/apps/api/package.json"
  fi
  # flock holds on fd 9 until this shell exits; close explicitly if open
  exec 9>&- 2>/dev/null || true
}
trap cleanup_call_assist_deploy EXIT

echo "▶ Refresh API vendor packs (shared + security + integrations)"
RC_API_PKG_BACKUP_SUFFIX=pre-call-assist rc_prepare_api_vendor_for_sam
REVERT_API_PKG="${REVERT_API_PKG:-1}"

echo "▶ Build api (vendor dist already synced)"
npm run build -w rapid-cortex-api

echo "▶ Unit tests (call-assist phase 1)"
npx vitest run \
  packages/shared/src/call-assist/case-number.test.ts \
  packages/shared/src/call-assist/routing-rules.test.ts \
  packages/shared/src/call-assist/response-generator.test.ts

echo "▶ sam validate call-assist nested template"
sam validate --lint --template-file "$ROOT/infra/nested/stack-app-sam-call-assist.yaml"

# Resolve Call Assist nested stack under rapid-cortex-dev
STACK_NAME="${STACK_NAME:-rapid-cortex-dev}"
CA_STACK="$(aws cloudformation describe-stack-resources \
  --stack-name "$STACK_NAME" \
  --region "$AWS_REGION" \
  --query "StackResources[?LogicalResourceId=='AppSamCallAssistStack' || contains(LogicalResourceId, 'CallAssist')].PhysicalResourceId" \
  --output text 2>/dev/null | awk '{print $1}' | awk -F/ '{print $(NF-1)}' || true)"

if [[ -z "${CA_STACK}" || "${CA_STACK}" == "None" ]]; then
  # Fallback: list stacks matching CallAssist
  CA_STACK="$(aws cloudformation list-stacks --stack-status-filter UPDATE_COMPLETE CREATE_COMPLETE \
    --query "StackSummaries[?contains(StackName, 'CallAssist')].StackName | [0]" --output text 2>/dev/null || true)"
fi

echo "▶ Call Assist nested stack: ${CA_STACK:-NOT_FOUND}"

if [[ -n "${CA_STACK}" && "${CA_STACK}" != "None" && "${CA_STACK}" != "null" ]]; then
  BUILD_DIR="${SAM_BUILD_DIR}/call-assist"
  mkdir -p "$BUILD_DIR"
  echo "▶ sam build → $BUILD_DIR"
  export SAM_LEAN_BUILD=1 SAM4_LEAN_BUILD=1
  sam build \
    --template-file "$ROOT/infra/nested/stack-app-sam-call-assist.yaml" \
    --build-dir "$BUILD_DIR" \
    --no-cached

  PARAMS="$(aws cloudformation describe-stacks \
    --stack-name "$CA_STACK" \
    --region "$AWS_REGION" \
    --query 'Stacks[0].Parameters[*].[ParameterKey,ParameterValue]' \
    --output text | awk 'NF >= 2 && $2 != "" && $2 != "****" {printf "%s=%s ", $1, $2}')"

  echo "▶ sam deploy → $CA_STACK"
  # shellcheck disable=SC2086
  sam deploy \
    --template-file "$BUILD_DIR/template.yaml" \
    --stack-name "$CA_STACK" \
    --capabilities CAPABILITY_IAM CAPABILITY_NAMED_IAM CAPABILITY_AUTO_EXPAND \
    --parameter-overrides ${PARAMS} \
    --resolve-s3 \
    --no-confirm-changeset \
    --no-fail-on-empty-changeset \
    --region "$AWS_REGION"
  echo "✅ Call Assist stack deploy complete"
else
  echo "⚠ Nested Call Assist stack not found — building API + surgical Lambda update of CallAssistHttpFunction"
  # Surgical: zip dist for Call Assist HTTP if we can find the function
  FN="$(aws lambda list-functions --query "Functions[?contains(FunctionName, 'CallAssist') && contains(FunctionName, 'Http')].FunctionName | [0]" --output text)"
  echo "  Function: ${FN}"
  if [[ -n "$FN" && "$FN" != "None" ]]; then
    TMP="$(mktemp -d)"
    # Prefer existing lean packaging if present; else ship dist + package.json (layer supplies deps)
    cp -R "$ROOT/apps/api/dist" "$TMP/"
    cp "$ROOT/apps/api/package.json" "$TMP/"
    (cd "$TMP" && zip -qr /tmp/call-assist-http.zip .)
    aws lambda update-function-code --function-name "$FN" --zip-file fileb:///tmp/call-assist-http.zip
    echo "✅ Updated $FN"
  else
    echo "ERROR: could not find CallAssist Http Lambda"
    exit 1
  fi
fi

echo "═══════════════════════════════════════════════════════"
echo " DONE $(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo " Log: $LOG"
echo "═══════════════════════════════════════════════════════"
