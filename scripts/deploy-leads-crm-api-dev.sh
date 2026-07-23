#!/usr/bin/env bash
# Surgical RC Admin Leads CRM API for rapid-cortex-dev (AppSam3 HttpApi).
# Adds /pipeline, /attribution-summary, /{leadId}/stage|notes|activities without full AppSam3.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

# shellcheck source=scripts/env-api-dev.sh
source "${ROOT}/scripts/env-api-dev.sh"
export AWS_PROFILE="${AWS_PROFILE:-rapid-cortex}"
export AWS_REGION="${AWS_REGION:-us-east-1}"
export AWS_DEFAULT_REGION="${AWS_DEFAULT_REGION:-$AWS_REGION}"
export NODE_OPTIONS="${NODE_OPTIONS:---max-old-space-size=8192}"

SAM_BUILD_DIR="/Volumes/Mac Mini/.sam-lean-build/leads-crm-$(date +%Y%m%d-%H%M%S)"
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

if [[ ! -f "${ROOT}/apps/api/dist/handlers/rc-admin/rcAdminLeadsHttp.js" ]]; then
  echo "── Compiling leads CRM handlers ──"
  npm run build -w rapid-cortex-api || true
fi
if [[ ! -f "${ROOT}/apps/api/dist/handlers/rc-admin/rcAdminLeadsHttp.js" ]]; then
  echo "ERROR: rcAdminLeadsHttp dist missing after build" >&2
  exit 1
fi
echo "── Using apps/api/dist/handlers/rc-admin/rcAdminLeadsHttp.js ──"

TEMPLATE="${ROOT}/infra/nested/stack-app-sam-3-leads-crm.yaml"
sam validate --lint --template-file "${TEMPLATE}"

sam build \
  --template-file "${TEMPLATE}" \
  --build-dir "${SAM_BUILD_DIR}" \
  --no-cached \
  --parallel \
  --build-in-source

STACK_NAME="${LEADS_CRM_API_STACK_NAME:-rapid-cortex-dev-AppSamLeadsCrmStack}"
HTTP_API_ID="${LEADS_CRM_HTTP_API_ID:-tbr4zvjlk5}"
JWT_AUTHORIZER_ID="${LEADS_CRM_JWT_AUTHORIZER_ID:-k8rjdh}"

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
    SalesLeadsTable=rapid-cortex-sales-leads-dev \
    AuditTable=rapid-cortex-audit-dev \
    AgenciesTable=rapid-cortex-agencies-dev \
    ImportedCognitoUserPoolId=us-east-1_0z6tA6WBs \
    ImportedCognitoWebClientId=7moi6sgc2uf4o31omgvo77h3v5 \
    ManagedPolicyNamePrefix=rapid-cortex-dev

echo "Leads CRM API stack status:"
aws cloudformation describe-stacks --stack-name "${STACK_NAME}" \
  --query 'Stacks[0].StackStatus' --output text

echo "Leads routes on ${HTTP_API_ID}:"
aws apigatewayv2 get-routes --api-id "${HTTP_API_ID}" \
  --query 'Items[?contains(RouteKey, `leads`)].[RouteKey,AuthorizationType]' \
  --output table
