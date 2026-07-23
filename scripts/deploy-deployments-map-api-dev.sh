#!/usr/bin/env bash
# Surgical GET /api/platform/deployments-map for rapid-cortex-dev (AppSam3 HttpApi).
# Fixes RC Admin Deployments map 404 when the web UI is live but the route was never
# published on HttpApi3 (full AppSam3Stack deploy can hang on large nested stacks).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

# shellcheck source=scripts/env-api-dev.sh
source "${ROOT}/scripts/env-api-dev.sh"
export AWS_PROFILE="${AWS_PROFILE:-rapid-cortex}"
export AWS_REGION="${AWS_REGION:-us-east-1}"
export AWS_DEFAULT_REGION="${AWS_DEFAULT_REGION:-$AWS_REGION}"
export NODE_OPTIONS="${NODE_OPTIONS:---max-old-space-size=8192}"

SAM_BUILD_DIR="/Volumes/Mac Mini/.sam-lean-build/deployments-map-$(date +%Y%m%d-%H%M%S)"
mkdir -p "${SAM_BUILD_DIR}"
export SAM_BUILD_DIR
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

if [[ ! -f "${ROOT}/apps/api/dist/handlers/getPlatformDeploymentsMap.js" ]]; then
  echo "── Compiling deployments-map handler ──"
  npm run build -w rapid-cortex-api || true
fi
if [[ ! -f "${ROOT}/apps/api/dist/handlers/getPlatformDeploymentsMap.js" ]]; then
  echo "ERROR: getPlatformDeploymentsMap dist missing after build" >&2
  exit 1
fi
echo "── Using apps/api/dist/handlers/getPlatformDeploymentsMap.js ──"

TEMPLATE="${ROOT}/infra/nested/stack-app-sam-3-deployments-map.yaml"
sam validate --lint --template-file "${TEMPLATE}"

sam build \
  --template-file "${TEMPLATE}" \
  --build-dir "${SAM_BUILD_DIR}" \
  --no-cached \
  --parallel \
  --build-in-source

STACK_NAME="${DEPLOYMENTS_MAP_API_STACK_NAME:-rapid-cortex-dev-AppSamDeploymentsMapStack}"
HTTP_API_ID="${DEPLOYMENTS_MAP_HTTP_API_ID:-tbr4zvjlk5}"
JWT_AUTHORIZER_ID="${DEPLOYMENTS_MAP_JWT_AUTHORIZER_ID:-k8rjdh}"

sam deploy \
  --template-file "${SAM_BUILD_DIR}/template.yaml" \
  --stack-name "${STACK_NAME}" \
  --capabilities CAPABILITY_IAM CAPABILITY_NAMED_IAM CAPABILITY_AUTO_EXPAND \
  --resolve-s3 \
  --no-confirm-changeset \
  --no-fail-on-empty-changeset \
  --region "${AWS_REGION}" \
  --parameter-overrides \
    DeploymentStage=dev \
    "HttpApiId=${HTTP_API_ID}" \
    "HttpApiJwtAuthorizerId=${JWT_AUTHORIZER_ID}" \
    AgenciesTable=rapid-cortex-agencies-dev \
    AuditTable=rapid-cortex-audit-dev \
    ImportedCognitoUserPoolId=us-east-1_0z6tA6WBs \
    ImportedCognitoWebClientId=7moi6sgc2uf4o31omgvo77h3v5 \
    ManagedPolicyNamePrefix=rapid-cortex-dev

echo "Deployments-map API stack status:"
aws cloudformation describe-stacks --stack-name "${STACK_NAME}" \
  --query 'Stacks[0].StackStatus' --output text

echo "Platform routes on ${HTTP_API_ID}:"
aws apigatewayv2 get-routes --api-id "${HTTP_API_ID}" \
  --query 'Items[?contains(RouteKey, `platform`)].[RouteKey,AuthorizationType]' \
  --output table
