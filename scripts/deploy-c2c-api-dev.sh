#!/usr/bin/env bash
# Surgical NENA EIDO C2C hub for rapid-cortex-dev (stack 2 HttpApi).
# Does not run a full parent SAM deploy. CAD write-back stays fail-closed.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

# shellcheck source=scripts/env-api-dev.sh
source "${ROOT}/scripts/env-api-dev.sh"
export AWS_PROFILE="${AWS_PROFILE:-rapid-cortex}"
export AWS_REGION="${AWS_REGION:-us-east-1}"
export AWS_DEFAULT_REGION="${AWS_DEFAULT_REGION:-$AWS_REGION}"
export NODE_OPTIONS="${NODE_OPTIONS:---max-old-space-size=8192}"
export CAD_WRITEBACK_ENABLED=false

SAM_BUILD_DIR="${C2C_SAM_BUILD_DIR:-${HOME}/.rapid-cortex-sam-build/c2c-$(date +%Y%m%d-%H%M%S)}"
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

echo "── Building shared + API ──"
npm run build -w rapid-cortex-shared
npm run build -w rapid-cortex-security || true
if [[ -d "${ROOT}/apps/api/node_modules/rapid-cortex-shared/dist" ]]; then
  rsync -a --delete "${ROOT}/packages/shared/dist/" "${ROOT}/apps/api/node_modules/rapid-cortex-shared/dist/" || true
fi
if [[ -d "${ROOT}/apps/api/node_modules/rapid-cortex-security/dist" ]]; then
  rsync -a --delete "${ROOT}/packages/security/dist/" "${ROOT}/apps/api/node_modules/rapid-cortex-security/dist/" || true
fi
npm run build -w rapid-cortex-api

if [[ ! -f "${ROOT}/apps/api/dist/handlers/c2c/http.js" ]]; then
  echo "ERROR: C2C HTTP handler dist missing after build" >&2
  exit 1
fi
if [[ ! -f "${ROOT}/apps/api/dist/handlers/c2c/webhook.js" ]]; then
  echo "ERROR: C2C webhook handler dist missing after build" >&2
  exit 1
fi

NM_SNAP="${HOME}/.rapid-cortex-sam-build/c2c-nm-snap-$$"
echo "Freezing apps/api/node_modules → ${NM_SNAP}"
mkdir -p "${NM_SNAP}"
rsync -a --delete "${ROOT}/apps/api/node_modules/" "${NM_SNAP}/"
export SAM_NODE_MODULES_SRC="${NM_SNAP}"
export SAM_NODE_MODULES_HARDLINK=1
cleanup_nm_snap() {
  rm -rf "${NM_SNAP}" 2>/dev/null || true
}
trap 'cleanup_nm_snap; restore_api_pkg' EXIT

TEMPLATE="${ROOT}/infra/nested/stack-app-sam-c2c.yaml"
sam validate --lint --template-file "${TEMPLATE}"
python3 "${ROOT}/scripts/check-iam-novalue-resources.py" --template "${TEMPLATE}" 2>/dev/null || python3 "${ROOT}/scripts/check-iam-novalue-resources.py"

sam build \
  --template-file "${TEMPLATE}" \
  --build-dir "${SAM_BUILD_DIR}" \
  --no-cached \
  --build-in-source

HTTP_API_ID="${C2C_HTTP_API_ID:-t4bdwpjfs5}"
JWT_AUTH_ID="${C2C_JWT_AUTHORIZER_ID:-}"
if [[ -z "${JWT_AUTH_ID}" ]]; then
  JWT_AUTH_ID="$(aws apigatewayv2 get-authorizers --api-id "${HTTP_API_ID}" \
    --query 'Items[?Name==`CognitoJwtAuthorizer`].AuthorizerId' --output text | awk '{print $1}')"
fi
if [[ -z "${JWT_AUTH_ID}" || "${JWT_AUTH_ID}" == "None" ]]; then
  JWT_AUTH_ID="3ui9q4"
fi

OPS_TOPIC="$(aws cloudformation describe-stacks \
  --stack-name rapid-cortex-dev-AppSam2Stack-1URVS591Q6ESS \
  --query 'Stacks[0].Outputs[?OutputKey==`OpsAlertsTopicArn`].OutputValue' \
  --output text 2>/dev/null || true)"
if [[ -z "${OPS_TOPIC}" || "${OPS_TOPIC}" == "None" ]]; then
  OPS_TOPIC=""
fi

STACK_NAME="${C2C_API_STACK_NAME:-rapid-cortex-dev-AppSamC2cStack}"

PARAM_OVERRIDES=(
  DeploymentStage=dev
  "HttpApiId=${HTTP_API_ID}"
  "HttpApiJwtAuthorizerId=${JWT_AUTH_ID}"
  ImportedCognitoUserPoolId=us-east-1_0z6tA6WBs
  ImportedCognitoWebClientId=7moi6sgc2uf4o31omgvo77h3v5
  AuditTable=rapid-cortex-audit-dev
  AgenciesTable=rapid-cortex-agencies-dev
  ManagedPolicyNamePrefix=rapid-cortex-dev
)
if [[ -n "${OPS_TOPIC}" ]]; then
  PARAM_OVERRIDES+=("OpsAlertsTopicArn=${OPS_TOPIC}")
fi

sam deploy \
  --template-file "${SAM_BUILD_DIR}/template.yaml" \
  --stack-name "${STACK_NAME}" \
  --capabilities CAPABILITY_IAM CAPABILITY_NAMED_IAM CAPABILITY_AUTO_EXPAND \
  --resolve-s3 \
  --force-upload \
  --no-confirm-changeset \
  --no-fail-on-empty-changeset \
  --region "${AWS_REGION}" \
  --parameter-overrides "${PARAM_OVERRIDES[@]}"

echo "C2C stack status:"
aws cloudformation describe-stacks --stack-name "${STACK_NAME}" \
  --query 'Stacks[0].StackStatus' --output text

echo "C2C routes on ${HTTP_API_ID}:"
aws apigatewayv2 get-routes --api-id "${HTTP_API_ID}" \
  --query 'Items[?contains(RouteKey, `c2c`)].[RouteKey,AuthorizationType]' \
  --output table

echo "✅ C2C API deploy complete (CAD_WRITEBACK_ENABLED=false)"
