#!/usr/bin/env bash
# Surgical GET /api/rc-admin/pricing/catalog for rapid-cortex-dev (AppSam3 HttpApi).
# Prefer this only when the route is missing. If the AppSam3 route already points at
# PricingCatalogFunction but the package lacks rapid-cortex-shared, use
# update-function-code on the existing Lambda instead (see script footer).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

# shellcheck source=scripts/env-api-dev.sh
source "${ROOT}/scripts/env-api-dev.sh"
export AWS_PROFILE="${AWS_PROFILE:-rapid-cortex}"
export AWS_REGION="${AWS_REGION:-us-east-1}"
export AWS_DEFAULT_REGION="${AWS_DEFAULT_REGION:-$AWS_REGION}"
export NODE_OPTIONS="${NODE_OPTIONS:---max-old-space-size=8192}"

SAM_BUILD_DIR="${SAM_BUILD_DIR:-${HOME}/.rapid-cortex-sam-build/pricing-catalog-$(date +%Y%m%d-%H%M%S)}"
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

if [[ ! -f "${ROOT}/apps/api/dist/handlers/rc-admin/pricing-catalog.js" ]]; then
  echo "── Compiling pricing-catalog handler ──"
  npm run build -w rapid-cortex-api || true
fi
if [[ ! -f "${ROOT}/apps/api/dist/handlers/rc-admin/pricing-catalog.js" ]]; then
  echo "ERROR: pricing-catalog dist missing after build" >&2
  exit 1
fi
echo "── Using apps/api/dist/handlers/rc-admin/pricing-catalog.js ──"

TEMPLATE="${ROOT}/infra/nested/stack-app-sam-3-pricing-catalog.yaml"
sam validate --lint --template-file "${TEMPLATE}"

sam build \
  --template-file "${TEMPLATE}" \
  --build-dir "${SAM_BUILD_DIR}" \
  --no-cached \
  --parallel \
  --build-in-source

STACK_NAME="${PRICING_CATALOG_API_STACK_NAME:-rapid-cortex-dev-AppSamPricingCatalogStack}"
HTTP_API_ID="${PRICING_CATALOG_HTTP_API_ID:-tbr4zvjlk5}"
JWT_AUTHORIZER_ID="${PRICING_CATALOG_JWT_AUTHORIZER_ID:-k8rjdh}"

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
    PricingTable=rapid-cortex-pricing-dev \
    AgenciesTable=rapid-cortex-agencies-dev \
    AuditTable=rapid-cortex-audit-dev \
    IncidentsTable=rapid-cortex-incidents-dev \
    TranscriptsTable=rapid-cortex-transcripts-dev \
    AnalysesTable=rapid-cortex-analyses-dev \
    InvitesTable=rapid-cortex-invites-dev \
    AssetsBucket=rapid-cortex-assets-dev-158961537080 \
    ImportedCognitoUserPoolId=us-east-1_0z6tA6WBs \
    ImportedCognitoWebClientId=7moi6sgc2uf4o31omgvo77h3v5 \
    ManagedPolicyNamePrefix=rapid-cortex-dev

echo "Pricing catalog API stack status:"
aws cloudformation describe-stacks --stack-name "${STACK_NAME}" \
  --query 'Stacks[0].StackStatus' --output text

echo "Pricing routes on ${HTTP_API_ID}:"
aws apigatewayv2 get-routes --api-id "${HTTP_API_ID}" \
  --query 'Items[?contains(RouteKey, `pricing`)].[RouteKey,AuthorizationType]' \
  --output table

echo ""
echo "Safer alternative when AppSam3 route already exists (package-only fix):"
echo "  1) sam build this template → zip the function artifact"
echo "  2) aws lambda update-function-code --function-name rapid-cortex-dev-AppSam3Sta-PricingCatalogFunction-m89M7D1HROe2 --zip-file fileb://..."
