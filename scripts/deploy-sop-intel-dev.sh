#!/usr/bin/env bash
# Surgical SOP Intelligence deploy for rapid-cortex-dev (HttpApi2 nested-style stack).
# Creates four Dynamo tables, HTTP + pattern-analyzer Lambdas, and
# ANY /api/sop-intelligence/{proxy+} on stack 2 (t4bdwpjfs5).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

# shellcheck source=scripts/env-api-dev.sh
source "${ROOT}/scripts/env-api-dev.sh"
export AWS_PROFILE="${AWS_PROFILE:-rapid-cortex}"
export AWS_REGION="${AWS_REGION:-us-east-1}"
export AWS_DEFAULT_REGION="${AWS_REGION}"
export NODE_OPTIONS="${NODE_OPTIONS:---max-old-space-size=8192}"
export ALLOW_EXTERNAL_DRIVE=1

# Internal boot volume is too tight for a full tree SAM build; isolate this
# two-function stack on the data volume (same pattern as ng911 surgical deploys).
SAM_BUILD_DIR="/Volumes/Mac Mini/.rapid-cortex-sam-build/sop-intel-$(date +%Y%m%d-%H%M%S)"
mkdir -p "${SAM_BUILD_DIR}"
export SAM_BUILD_DIR
export TMPDIR="/Volumes/Mac Mini/.rapid-cortex-tmp"
mkdir -p "${TMPDIR}"
echo "SAM_BUILD_DIR=${SAM_BUILD_DIR}"

# shellcheck source=scripts/lib/api-vendor-lock.sh
source "${ROOT}/scripts/lib/api-vendor-lock.sh"
# shellcheck source=scripts/lib/prepare-api-vendor-for-sam.sh
source "${ROOT}/scripts/lib/prepare-api-vendor-for-sam.sh"

rc_acquire_api_vendor_lock
REVERT_API_PKG=1
restore_api_pkg() {
  if [[ "${REVERT_API_PKG}" -eq 1 ]]; then
    if [[ -f "${ROOT}/apps/api/package.json.pre-lean" ]]; then
      mv "${ROOT}/apps/api/package.json.pre-lean" "${ROOT}/apps/api/package.json"
    else
      git -C "${ROOT}" checkout HEAD -- apps/api/package.json 2>/dev/null || true
    fi
  fi
  rc_release_api_vendor_lock 2>/dev/null || true
}
trap restore_api_pkg EXIT

RC_API_PKG_BACKUP_SUFFIX=pre-lean rc_prepare_api_vendor_for_sam
npm run build -w rapid-cortex-api

NM_SNAP="/Volumes/Mac Mini/.rapid-cortex-tmp/rc-nm-snap-sop-intel-$$"
echo "Freezing apps/api/node_modules → ${NM_SNAP}"
mkdir -p "${NM_SNAP}"
rsync -a --delete "${ROOT}/apps/api/node_modules/" "${NM_SNAP}/"
export SAM_NODE_MODULES_SRC="${NM_SNAP}"
export SAM_NODE_MODULES_HARDLINK=1
cleanup_nm_snap() {
  rm -rf "${NM_SNAP}" 2>/dev/null || true
}
trap 'cleanup_nm_snap; restore_api_pkg' EXIT

sam validate --lint --template-file "${ROOT}/infra/nested/stack-app-sam-sop-intel.yaml"

sam build \
  --template-file "${ROOT}/infra/nested/stack-app-sam-sop-intel.yaml" \
  --build-dir "${SAM_BUILD_DIR}" \
  --no-cached \
  --build-in-source

JWT_AUTH_ID="$(aws apigatewayv2 get-authorizers --api-id t4bdwpjfs5 \
  --query 'Items[?Name==`CognitoJwtAuthorizer`].AuthorizerId' --output text | awk '{print $1}')"

sam deploy \
  --template-file "${SAM_BUILD_DIR}/template.yaml" \
  --stack-name rapid-cortex-dev-AppSamSopIntelStack2 \
  --capabilities CAPABILITY_IAM CAPABILITY_NAMED_IAM CAPABILITY_AUTO_EXPAND \
  --resolve-s3 \
  --force-upload \
  --no-confirm-changeset \
  --no-fail-on-empty-changeset \
  --region "${AWS_REGION}" \
  --parameter-overrides \
    DeploymentStage=dev \
    HttpApiId=t4bdwpjfs5 \
    "HttpApiJwtAuthorizerId=${JWT_AUTH_ID}" \
    ImportedCognitoUserPoolId=us-east-1_0z6tA6WBs \
    ImportedCognitoWebClientId=7moi6sgc2uf4o31omgvo77h3v5 \
    ImportedCognitoIssuer=https://cognito-idp.us-east-1.amazonaws.com/us-east-1_0z6tA6WBs \
    AuditTable=rapid-cortex-audit-dev \
    AgenciesTable=rapid-cortex-agencies-dev \
    WebSocketConnectionsTable=rapid-cortex-websocket-connections-dev \
    WebSocketApiEndpoint=https://g0wzu18e2k.execute-api.us-east-1.amazonaws.com/dev \
    WebSocketApiId=g0wzu18e2k \
    AnthropicApiKeySecretArn=arn:aws:secretsmanager:us-east-1:158961537080:secret:rapid-cortex/ai/anthropic-fHk4y2 \
    AppPublicBaseUrl=https://app.rapidcortex.us \
    ManagedPolicyNamePrefix=rapid-cortex-dev

echo "SOP Intelligence API stack deployed: rapid-cortex-dev-AppSamSopIntelStack2"
