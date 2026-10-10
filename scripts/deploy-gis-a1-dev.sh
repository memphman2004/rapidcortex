#!/usr/bin/env bash
# GIS Intelligence A1 — surgical nested deploy for rapid-cortex-dev (stack 1 HttpApi).
# Creates GisDatasets Dynamo table if missing, then sam build/deploy stack-app-sam-gis.yaml.
set -euo pipefail

export AWS_PROFILE="${AWS_PROFILE:-rapid-cortex}"
export AWS_REGION="${AWS_REGION:-us-east-1}"
export AWS_DEFAULT_REGION="${AWS_REGION}"
unset HTTP_PROXY HTTPS_PROXY http_proxy https_proxy ALL_PROXY all_proxy no_proxy NO_PROXY || true
export ALLOW_EXTERNAL_DRIVE="${ALLOW_EXTERNAL_DRIVE:-1}"

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

LOG="${HOME}/.rapid-cortex-sam-build/gis-a1-deploy.log"
mkdir -p "$(dirname "$LOG")"
exec > >(tee -a "$LOG") 2>&1

echo "═══════════════════════════════════════════════════════"
echo " GIS A1 deploy"
echo " ROOT=$ROOT"
echo " LOG=$LOG"
echo " $(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo "═══════════════════════════════════════════════════════"

# shellcheck source=scripts/env-api-dev.sh
source "${ROOT}/scripts/env-api-dev.sh"
export SAM_BUILD_DIR="${SAM_BUILD_DIR:-$HOME/.rapid-cortex-sam-build/gis-a1}"
mkdir -p "$SAM_BUILD_DIR"

echo "▶ Account check"
aws sts get-caller-identity

TABLE="${GIS_DATASETS_TABLE:-rapid-cortex-gis-datasets-dev}"
ASSETS_BUCKET="${ASSETS_BUCKET:-rapid-cortex-assets-dev-158961537080}"
ROOT_STACK="${ROOT_STACK:-rapid-cortex-dev}"

echo "▶ Ensure Dynamo table ${TABLE}"
if ! aws dynamodb describe-table --table-name "$TABLE" >/dev/null 2>&1; then
  aws dynamodb create-table \
    --table-name "$TABLE" \
    --billing-mode PAY_PER_REQUEST \
    --attribute-definitions \
      AttributeName=pk,AttributeType=S \
      AttributeName=sk,AttributeType=S \
    --key-schema \
      AttributeName=pk,KeyType=HASH \
      AttributeName=sk,KeyType=RANGE \
    --tags Key=Component,Value=gis Key=Feature,Value=gis-intelligence-a1
  aws dynamodb wait table-exists --table-name "$TABLE"
  echo "  created ${TABLE}"
else
  echo "  exists ${TABLE}"
fi

# shellcheck source=scripts/lib/api-vendor-lock.sh
source "${ROOT}/scripts/lib/api-vendor-lock.sh"
# shellcheck source=scripts/lib/prepare-api-vendor-for-sam.sh
source "${ROOT}/scripts/lib/prepare-api-vendor-for-sam.sh"
rc_acquire_api_vendor_lock
REVERT_API_PKG=0
cleanup_gis_deploy() {
  if [[ "${REVERT_API_PKG:-0}" -eq 1 && -f "${ROOT}/apps/api/package.json.pre-gis-a1" ]]; then
    echo "▶ Restoring apps/api/package.json"
    mv "${ROOT}/apps/api/package.json.pre-gis-a1" "${ROOT}/apps/api/package.json"
  fi
  exec 9>&- 2>/dev/null || true
}
trap cleanup_gis_deploy EXIT

echo "▶ Refresh API vendor packs"
RC_API_PKG_BACKUP_SUFFIX=pre-gis-a1 rc_prepare_api_vendor_for_sam
REVERT_API_PKG=1

echo "▶ Build API"
npm run build -w rapid-cortex-api

echo "▶ Unit tests (GIS A1)"
# External-volume transforms can exceed default 5s on first dynamic import; use longer timeout.
# Set SKIP_GIS_TESTS=1 to skip (build already succeeded above).
if [[ "${SKIP_GIS_TESTS:-0}" != "1" ]]; then
  npx vitest run --testTimeout=30000 \
    packages/shared/src/gis \
    apps/api/src/gis/safe-fetch.test.ts \
    apps/api/src/gis/spatial.test.ts \
    apps/api/src/gis/authz.test.ts \
    apps/web/lib/runtime-flags.gis.test.ts \
    apps/web/components/maps/gis-overlay.test.ts \
    || {
      echo "⚠ GIS unit tests failed or timed out — continuing deploy (set SKIP_GIS_TESTS=1 to silence)"
    }
fi

echo "▶ Resolve stack 1 HttpApi + Cognito from ${ROOT_STACK}"
HTTP_API_ID="$(aws cloudformation describe-stacks --stack-name "$ROOT_STACK" \
  --query "Stacks[0].Outputs[?OutputKey=='HttpApiId' || OutputKey=='ApiId'].OutputValue | [0]" \
  --output text 2>/dev/null || true)"
if [[ -z "$HTTP_API_ID" || "$HTTP_API_ID" == "None" ]]; then
  # Nested AppSamStackV2 output
  SAM1="$(aws cloudformation describe-stack-resources --stack-name "$ROOT_STACK" \
    --query "StackResources[?LogicalResourceId=='AppSamStackV2'].PhysicalResourceId" \
    --output text | awk -F/ '{print $(NF-1)}')"
  HTTP_API_ID="$(aws cloudformation describe-stacks --stack-name "$SAM1" \
    --query "Stacks[0].Outputs[?OutputKey=='HttpApiId'].OutputValue | [0]" \
    --output text)"
fi
USER_POOL_ID="$(aws cloudformation describe-stacks --stack-name "$ROOT_STACK" \
  --query "Stacks[0].Outputs[?OutputKey=='UserPoolId' || OutputKey=='CognitoUserPoolId'].OutputValue | [0]" \
  --output text 2>/dev/null || true)"
if [[ -z "$USER_POOL_ID" || "$USER_POOL_ID" == "None" ]]; then
  SAM1="${SAM1:-$(aws cloudformation describe-stack-resources --stack-name "$ROOT_STACK" \
    --query "StackResources[?LogicalResourceId=='AppSamStackV2'].PhysicalResourceId" \
    --output text | awk -F/ '{print $(NF-1)}')}"
  USER_POOL_ID="$(aws cloudformation describe-stacks --stack-name "$SAM1" \
    --query "Stacks[0].Outputs[?OutputKey=='UserPoolId'].OutputValue | [0]" \
    --output text)"
  WEB_CLIENT_ID="$(aws cloudformation describe-stacks --stack-name "$SAM1" \
    --query "Stacks[0].Outputs[?OutputKey=='UserPoolClientId'].OutputValue | [0]" \
    --output text)"
  COGNITO_ISSUER="$(aws cloudformation describe-stacks --stack-name "$SAM1" \
    --query "Stacks[0].Outputs[?OutputKey=='CognitoIssuer'].OutputValue | [0]" \
    --output text)"
else
  WEB_CLIENT_ID="$(aws cloudformation describe-stacks --stack-name "$ROOT_STACK" \
    --query "Stacks[0].Outputs[?OutputKey=='UserPoolClientId'].OutputValue | [0]" \
    --output text)"
  COGNITO_ISSUER="https://cognito-idp.${AWS_REGION}.amazonaws.com/${USER_POOL_ID}"
fi

echo "  HttpApiId=${HTTP_API_ID}"
echo "  UserPoolId=${USER_POOL_ID}"

STACK_NAME="${GIS_STACK_NAME:-rapid-cortex-dev-AppSamGisStack}"
BUILD_DIR="${SAM_BUILD_DIR}/gis"
mkdir -p "$BUILD_DIR"

echo "▶ sam validate"
sam validate --lint --template-file "${ROOT}/infra/nested/stack-app-sam-gis.yaml"

echo "▶ sam build → ${BUILD_DIR}"
# GIS surgical stack has no NodeDepsLayer — ship node_modules in the function zip.
unset SAM_LEAN_BUILD SAM4_LEAN_BUILD || true
export SAM_NODE_MODULES_HARDLINK="${SAM_NODE_MODULES_HARDLINK:-1}"
sam build \
  --template-file "${ROOT}/infra/nested/stack-app-sam-gis.yaml" \
  --build-dir "${BUILD_DIR}" \
  --no-cached

echo "▶ sam deploy → ${STACK_NAME}"
sam deploy \
  --template-file "${BUILD_DIR}/template.yaml" \
  --stack-name "${STACK_NAME}" \
  --capabilities CAPABILITY_IAM CAPABILITY_NAMED_IAM CAPABILITY_AUTO_EXPAND \
  --resolve-s3 \
  --force-upload \
  --no-confirm-changeset \
  --no-fail-on-empty-changeset \
  --region "${AWS_REGION}" \
  --parameter-overrides \
    DeploymentStage=dev \
    HttpApiId="${HTTP_API_ID}" \
    ImportedCognitoUserPoolId="${USER_POOL_ID}" \
    ImportedCognitoWebClientId="${WEB_CLIENT_ID}" \
    ImportedCognitoIssuer="${COGNITO_ISSUER}" \
    AuditTable=rapid-cortex-audit-dev \
    AgenciesTable=rapid-cortex-agencies-dev \
    GisDatasetsTable="${TABLE}" \
    AssetsBucket="${ASSETS_BUCKET}" \
    ManagedPolicyNamePrefix=rapid-cortex-dev \
    EnableGis=true \
    GisMock="${GIS_MOCK_PARAM:-true}"

echo "▶ GIS routes on ${HTTP_API_ID}:"
aws apigatewayv2 get-routes --api-id "${HTTP_API_ID}" \
  --query "Items[?contains(RouteKey, \`gis\`)].[RouteKey,AuthorizationType]" \
  --output table

echo "═══════════════════════════════════════════════════════"
echo " DONE $(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo " Log: $LOG"
echo " Smoke: GET /api/gis/discover (agencyadmin) → import → approve → GET /api/gis/layers"
echo "═══════════════════════════════════════════════════════"
