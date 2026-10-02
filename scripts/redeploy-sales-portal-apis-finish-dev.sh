#!/usr/bin/env bash
# Finish sales portal after contacts OK; skip NexiQ CREATE (routes/layer already owned by RapidIq).
# Conferences + PricingCatalog: update-function-code on live AppSam3/RapidIq Lambdas.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
export AWS_PROFILE="${AWS_PROFILE:-rapid-cortex}"
export AWS_REGION="${AWS_REGION:-us-east-1}"
export AWS_DEFAULT_REGION="${AWS_DEFAULT_REGION:-$AWS_REGION}"
export NODE_OPTIONS="${NODE_OPTIONS:---max-old-space-size=8192}"

LOG="${HOME}/.rapid-cortex-sam-build/sales-portal-finish-$(date +%Y%m%d-%H%M%S).log"
mkdir -p "$(dirname "$LOG")"
exec > >(tee -a "$LOG") 2>&1
echo "LOG=$LOG"

# shellcheck source=scripts/lib/api-vendor-lock.sh
source "${ROOT}/scripts/lib/api-vendor-lock.sh"
# shellcheck source=scripts/lib/prepare-api-vendor-for-sam.sh
source "${ROOT}/scripts/lib/prepare-api-vendor-for-sam.sh"
# shellcheck source=scripts/env-api-dev.sh
source "${ROOT}/scripts/env-api-dev.sh"

rc_wait_for_api_vendor_lock

echo "════════ leads CRM ════════"
bash "${ROOT}/scripts/deploy-leads-crm-api-dev.sh"

echo "════════ Build lean artifact for Conferences + PricingCatalog code push ════════"
BUILD_DIR="${HOME}/.rapid-cortex-sam-build/sales-codefix-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BUILD_DIR"
export SAM_BUILD_DIR="$BUILD_DIR"

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
npm run build -w rapid-cortex-api || true

# Reuse pricing-catalog lean template build (vendored node_modules + dist)
sam build \
  --template-file "${ROOT}/infra/nested/stack-app-sam-3-pricing-catalog.yaml" \
  --build-dir "${BUILD_DIR}" \
  --no-cached \
  --parallel \
  --build-in-source

FN_DIR="$(find "${BUILD_DIR}" -type d -name 'PricingCatalogFunction' | head -1 || true)"
if [[ -z "$FN_DIR" || ! -d "$FN_DIR" ]]; then
  echo "ERROR: PricingCatalogFunction build dir missing" >&2
  exit 1
fi

ZIP="${BUILD_DIR}/api-code.zip"
(cd "$FN_DIR" && zip -qr "$ZIP" .)
echo "ZIP size: $(wc -c < "$ZIP") bytes"

PRICING_FN="rapid-cortex-dev-AppSam3Sta-PricingCatalogFunction-m89M7D1HROe2"
CONF_FN="rapid-cortex-dev-AppSamRap-ConferencesHttpFunction-0try5lG9XeEr"
# Also refresh lean RapidIq conferences if present with different package
DEP_MAP_FN="rapid-cortex-dev-AppSam3S-GetPlatformDeploymentsMa-nfnYnIeygt5Y"

for FN in "$PRICING_FN" "$CONF_FN" "$DEP_MAP_FN"; do
  echo "── update-function-code → ${FN} ──"
  aws lambda update-function-code \
    --function-name "$FN" \
    --zip-file "fileb://${ZIP}" \
    --query '{FunctionName:FunctionName,CodeSize:CodeSize,LastModified:LastModified}' \
    --output json
  aws lambda wait function-updated --function-name "$FN"
done

echo "DONE_SALES_PORTAL_FINISH $(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo "LOG=$LOG"
