#!/usr/bin/env bash
# Surgical Inside-the-Cortex marketing lead API for rapid-cortex-dev (AppSam3 HttpApi).
# Avoids full AppSam3Stack deploy (force-upload hang on large nested stack).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

# shellcheck source=scripts/env-api-dev.sh
source "${ROOT}/scripts/env-api-dev.sh"
export AWS_PROFILE="${AWS_PROFILE:-rapid-cortex}"
export AWS_REGION="${AWS_REGION:-us-east-1}"
export AWS_DEFAULT_REGION="${AWS_DEFAULT_REGION:-$AWS_REGION}"
export NODE_OPTIONS="${NODE_OPTIONS:---max-old-space-size=8192}"

SAM_BUILD_DIR="/Volumes/Mac Mini/.sam-lean-build/marketing-$(date +%Y%m%d-%H%M%S)"
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
# Full workspace tsc often fails on duplicate @aws-sdk types after --no-workspaces install.
# Marketing handlers are small; emit only those entrypoints when a full build is unavailable.
if [[ ! -f "${ROOT}/apps/api/dist/handlers/marketing-lead.js" ]] || \
   [[ ! -f "${ROOT}/apps/api/dist/handlers/marketing-unsubscribe.js" ]] || \
   [[ ! -f "${ROOT}/apps/api/dist/handlers/marketing-og-share.js" ]]; then
  echo "── Compiling marketing handlers (tsc project may report unrelated errors) ──"
  npm run build -w rapid-cortex-api || true
fi
if [[ ! -f "${ROOT}/apps/api/dist/handlers/marketing-lead.js" ]] || \
   [[ ! -f "${ROOT}/apps/api/dist/handlers/marketing-unsubscribe.js" ]] || \
   [[ ! -f "${ROOT}/apps/api/dist/handlers/marketing-og-share.js" ]]; then
  echo "ERROR: marketing handler dist missing after build" >&2
  exit 1
fi
echo "── Using apps/api/dist marketing handlers ──"

TEMPLATE="${ROOT}/infra/nested/stack-app-sam-3-marketing.yaml"
sam validate --lint --template-file "${TEMPLATE}"

sam build \
  --template-file "${TEMPLATE}" \
  --build-dir "${SAM_BUILD_DIR}" \
  --no-cached \
  --parallel \
  --build-in-source

STACK_NAME="${MARKETING_API_STACK_NAME:-rapid-cortex-dev-AppSamMarketingStack}"
HTTP_API_ID="${MARKETING_HTTP_API_ID:-tbr4zvjlk5}"

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
    MarketingLeadsTable=rapid-cortex-marketing-leads-dev \
    SalesLeadsTable=rapid-cortex-sales-leads-dev \
    AuditTable=rapid-cortex-audit-dev \
    AgenciesTable=rapid-cortex-agencies-dev \
    IncidentsTable=rapid-cortex-incidents-dev \
    TranscriptsTable=rapid-cortex-transcripts-dev \
    AnalysesTable=rapid-cortex-analyses-dev \
    InvitesTable=rapid-cortex-invites-dev \
    AssetsBucket=rapid-cortex-assets-dev-158961537080 \
    ImportedCognitoUserPoolId=us-east-1_0z6tA6WBs \
    ImportedCognitoWebClientId=7moi6sgc2uf4o31omgvo77h3v5 \
    ManagedPolicyNamePrefix=rapid-cortex-dev \
    SesFromEmail=noreply@rapidcortex.us \
    RcTeamNotifyEmail=team@rapidcortex.us \
    SesMock=false \
    MarketingSiteOrigin=https://www.rapidcortex.us

echo "Marketing API stack status:"
aws cloudformation describe-stacks --stack-name "${STACK_NAME}" \
  --query 'Stacks[0].StackStatus' --output text

echo "Marketing routes on ${HTTP_API_ID}:"
aws apigatewayv2 get-routes --api-id "${HTTP_API_ID}" \
  --query 'Items[?contains(RouteKey, `marketing`)].[RouteKey,AuthorizationType]' \
  --output table
