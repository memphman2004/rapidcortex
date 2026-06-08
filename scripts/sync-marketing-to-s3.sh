#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
# shellcheck source=scripts/lib/static-s3-hosting.sh
source "${ROOT}/scripts/lib/static-s3-hosting.sh"

BUCKET="${MARKETING_S3_BUCKET:-rapid-cortex-v2-web-static-prod-158961537080}"
DIST_ID="${MARKETING_CF_DIST_ID:-EWZ286WS69KX1}"
REGION="${AWS_REGION:-us-east-1}"
STATIC_DIR="${ROOT}/apps/marketing/out"
REQUIRED_ROUTES=(enter demo pricing)

if [[ ! -d "${STATIC_DIR}" ]] || [[ ! -f "${STATIC_DIR}/index.html" ]]; then
  echo "ERROR: apps/marketing/out/ not found. Run scripts/build-marketing.sh first." >&2
  exit 1
fi

static_s3_verify_local_css_refs "${STATIC_DIR}"
static_s3_verify_local_extensionless_routes "${STATIC_DIR}" "${REQUIRED_ROUTES[@]}"
static_s3_prepare_root_html_dirs "${STATIC_DIR}"

static_s3_sync_two_pass "${STATIC_DIR}" "${BUCKET}" "${REGION}"
static_s3_upload_extensionless_keys "${STATIC_DIR}" "${BUCKET}" "${REGION}"
static_s3_write_build_manifest "${STATIC_DIR}" "${BUCKET}" "${REGION}"

static_s3_verify_remote_deploy "${STATIC_DIR}" "${BUCKET}" "${REGION}" "${REQUIRED_ROUTES[@]}"

static_s3_invalidate_cloudfront "${DIST_ID}" "${REGION}"

echo "Marketing site synced, verified, and CloudFront invalidated."
