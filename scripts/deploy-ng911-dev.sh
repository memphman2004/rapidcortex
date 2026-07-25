#!/usr/bin/env bash
# Surgical NG9-1-1 assist deploy for rapid-cortex-dev (HttpApi2 nested stack).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

# shellcheck source=scripts/env-api-dev.sh
source "${ROOT}/scripts/env-api-dev.sh"
export AWS_PROFILE="${AWS_PROFILE:-rapid-cortex}"
export AWS_REGION="${AWS_REGION:-us-east-1}"
export AWS_DEFAULT_REGION="${AWS_DEFAULT_REGION:-$AWS_REGION}"
export NODE_OPTIONS="${NODE_OPTIONS:---max-old-space-size=8192}"

SAM_BUILD_DIR="/Volumes/Mac Mini/.sam-lean-build/ng911-$(date +%Y%m%d-%H%M%S)"
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
npm run build -w rapid-cortex-shared
npm run build -w rapid-cortex-security
npm run build -w rapid-cortex-api

sam validate --lint --template-file "${ROOT}/infra/nested/stack-app-sam-2-ng911.yaml"

sam build \
  --template-file "${ROOT}/infra/nested/stack-app-sam-2-ng911.yaml" \
  --build-dir "${SAM_BUILD_DIR}" \
  --no-cached \
  --parallel \
  --build-in-source

JWT_AUTH_ID="$(aws apigatewayv2 get-authorizers --api-id t4bdwpjfs5 \
  --query 'Items[?Name==`CognitoJwtAuthorizer`].AuthorizerId' --output text | awk '{print $1}')"

sam deploy \
  --template-file "${SAM_BUILD_DIR}/template.yaml" \
  --stack-name rapid-cortex-dev-AppSamNg911Stack2 \
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
    IncidentsTable=rapid-cortex-incidents-dev \
    TranscriptsTable=rapid-cortex-transcripts-dev \
    AnalysesTable=rapid-cortex-analyses-dev \
    InvitesTable=rapid-cortex-invites-dev \
    AssetsBucket=rapid-cortex-assets-dev-158961537080 \
    PremiseNotesTable=rapid-cortex-premise-notes-dev \
    IncidentMediaTable=rapid-cortex-incident-media-dev \
    NonEmergencyQueueTable=rapid-cortex-non-emergency-queue-dev \
    ExistingNg911AssistTableName=rapid-cortex-ng911-assist-dev \
    ManagedPolicyNamePrefix=rapid-cortex-dev

echo "NG911 stack status:"
aws cloudformation describe-stacks --stack-name rapid-cortex-dev-AppSamNg911Stack2 \
  --query 'Stacks[0].StackStatus' --output text

echo "NG911 routes:"
aws apigatewayv2 get-routes --api-id t4bdwpjfs5 \
  --query 'Items[?contains(RouteKey, `ng911`) || contains(RouteKey, `diversion`) || contains(RouteKey, `additional-data`) || contains(RouteKey, `/eido`)].[RouteKey,AuthorizationType]' \
  --output table
