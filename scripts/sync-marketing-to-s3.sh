#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

BUCKET="${MARKETING_S3_BUCKET:-rapid-cortex-v2-web-static-prod-158961537080}"
DIST_ID="${MARKETING_CF_DIST_ID:-EWZ286WS69KX1}"
REGION="${AWS_REGION:-us-east-1}"
STATIC_DIR="${ROOT}/apps/marketing/out"

if [[ ! -d "${STATIC_DIR}" ]] || [[ ! -f "${STATIC_DIR}/index.html" ]]; then
  echo "ERROR: apps/marketing/out/ not found. Run scripts/build-marketing.sh first." >&2
  exit 1
fi

echo "Preparing trailing-slash routes in ${STATIC_DIR} ..."
for html_file in "${STATIC_DIR}"/*.html; do
  [[ -f "${html_file}" ]] || continue
  route_name="$(basename "${html_file}" .html)"
  if [[ "${route_name}" == "index" || "${route_name}" == "404" ]]; then
    continue
  fi
  mkdir -p "${STATIC_DIR}/${route_name}"
  cp "${html_file}" "${STATIC_DIR}/${route_name}/index.html"
done

echo "Syncing marketing build to s3://${BUCKET}/"
aws s3 sync "${STATIC_DIR}/" "s3://${BUCKET}/" \
  --delete \
  --region "${REGION}" \
  --cache-control "public, max-age=31536000, immutable" \
  --exclude "*.html"

aws s3 sync "${STATIC_DIR}/" "s3://${BUCKET}/" \
  --region "${REGION}" \
  --cache-control "public, max-age=300, must-revalidate" \
  --include "*.html" \
  --exclude "*"

echo "Invalidating CloudFront distribution ${DIST_ID}..."
aws cloudfront create-invalidation \
  --distribution-id "${DIST_ID}" \
  --paths "/*" \
  --region us-east-1

echo "Marketing site synced and CloudFront invalidated."
