#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
# shellcheck source=scripts/lib/static-s3-hosting.sh
source "${ROOT}/scripts/lib/static-s3-hosting.sh"
# shellcheck source=scripts/lib/rapid-cortex-aws.sh
source "${ROOT}/scripts/lib/rapid-cortex-aws.sh"

export AWS_PROFILE="${AWS_PROFILE:-rapid-cortex}"
export AWS_REGION="${AWS_REGION:-${RAPID_CORTEX_AWS_REGION}}"

BUCKET="${MARKETING_S3_BUCKET:-${RAPID_CORTEX_MARKETING_S3_BUCKET}}"
DIST_ID="${MARKETING_CF_DIST_ID:-${RAPID_CORTEX_MARKETING_CF_DIST_ID}}"
REGION="${AWS_REGION}"
STATIC_DIR="${ROOT}/apps/marketing/out"
REQUIRED_ROUTES=(enter demo pricing blog unsubscribe)

rapid_cortex_assert_aws_account

if [[ ! -d "${STATIC_DIR}" ]] || [[ ! -f "${STATIC_DIR}/index.html" ]]; then
  echo "ERROR: apps/marketing/out/ not found. Run scripts/build-marketing.sh first." >&2
  exit 1
fi

static_s3_verify_local_css_refs "${STATIC_DIR}"
static_s3_verify_local_brand_assets "${STATIC_DIR}"
static_s3_verify_local_extensionless_routes "${STATIC_DIR}" "${REQUIRED_ROUTES[@]}"
static_s3_prepare_root_html_dirs "${STATIC_DIR}"

static_s3_sync_two_pass "${STATIC_DIR}" "${BUCKET}" "${REGION}"
static_s3_upload_extensionless_keys "${STATIC_DIR}" "${BUCKET}" "${REGION}"
static_s3_write_build_manifest "${STATIC_DIR}" "${BUCKET}" "${REGION}"

static_s3_verify_remote_deploy "${STATIC_DIR}" "${BUCKET}" "${REGION}" "${REQUIRED_ROUTES[@]}"

if static_s3_invalidate_cloudfront "${DIST_ID}" "${REGION}"; then
  echo "Marketing site synced, verified, and CloudFront invalidated."
else
  echo "Marketing site synced and verified (S3 OK; CloudFront cache may be stale until invalidated)."
fi
