#!/usr/bin/env bash
# Sequential sales-portal lean redeploys after call-assist releases vendor lock.
# Contacts: delete stack first (routes drifted off HttpApi; CFN still thinks they exist).
# PricingCatalog: update-function-code on AppSam3 Lambda (route already exists).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
export AWS_PROFILE="${AWS_PROFILE:-rapid-cortex}"
export AWS_REGION="${AWS_REGION:-us-east-1}"
export AWS_DEFAULT_REGION="${AWS_DEFAULT_REGION:-$AWS_REGION}"

LOG_DIR="${HOME}/.rapid-cortex-sam-build"
mkdir -p "$LOG_DIR"
LOG="${LOG_DIR}/sales-portal-lean-redeploy-$(date +%Y%m%d-%H%M%S).log"
exec > >(tee -a "$LOG") 2>&1
echo "LOG=$LOG"

# shellcheck source=scripts/lib/api-vendor-lock.sh
source "${ROOT}/scripts/lib/api-vendor-lock.sh"

echo "Waiting for api vendor lock (call-assist may hold it)…"
rc_wait_for_api_vendor_lock
echo "Lock free at $(date -u +%Y-%m-%dT%H:%M:%SZ)"

echo "════════ 1/4 deployments-map ════════"
bash "${ROOT}/scripts/deploy-deployments-map-api-dev.sh"

echo "════════ 2/4 contacts ════════"
# Tables are Retain leftovers — template uses ExistingContact* params (no CREATE).
bash "${ROOT}/scripts/deploy-contacts-api-dev.sh"

echo "════════ 3/4 rapid-iq / conferences ════════"
bash "${ROOT}/scripts/deploy-rapid-iq-api-dev.sh"

echo "════════ 4/4 leads CRM ════════"
bash "${ROOT}/scripts/deploy-leads-crm-api-dev.sh"

echo "════════ PricingCatalog: update-function-code (safer; route exists) ════════"
PRICING_BUILD="${HOME}/.rapid-cortex-sam-build/pricing-catalog-codefix-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$PRICING_BUILD"
export SAM_BUILD_DIR="$PRICING_BUILD"

# shellcheck source=scripts/env-api-dev.sh
source "${ROOT}/scripts/env-api-dev.sh"
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
npm run build -w rapid-cortex-api || true

sam build \
  --template-file "${ROOT}/infra/nested/stack-app-sam-3-pricing-catalog.yaml" \
  --build-dir "${PRICING_BUILD}" \
  --no-cached \
  --parallel \
  --build-in-source

FN_DIR="$(find "${PRICING_BUILD}" -type d -name 'PricingCatalogFunction' | head -1 || true)"
echo "FN_DIR=${FN_DIR}"
if [[ -z "$FN_DIR" || ! -d "$FN_DIR" ]]; then
  echo "ERROR: PricingCatalogFunction build dir not found under ${PRICING_BUILD}" >&2
  find "${PRICING_BUILD}" -maxdepth 4 -type d 2>/dev/null || true
  exit 1
fi

ZIP="${PRICING_BUILD}/pricing-catalog-code.zip"
(cd "$FN_DIR" && zip -qr "$ZIP" .)
aws lambda update-function-code \
  --function-name rapid-cortex-dev-AppSam3Sta-PricingCatalogFunction-m89M7D1HROe2 \
  --zip-file "fileb://${ZIP}" \
  --query '{FunctionName:FunctionName,CodeSize:CodeSize,LastModified:LastModified}' \
  --output json
aws lambda wait function-updated \
  --function-name rapid-cortex-dev-AppSam3Sta-PricingCatalogFunction-m89M7D1HROe2
echo "PricingCatalog code updated"

echo "DONE_SALES_PORTAL_REDEPLOY $(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo "LOG=$LOG"
