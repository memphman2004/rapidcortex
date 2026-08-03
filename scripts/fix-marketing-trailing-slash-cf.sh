#!/usr/bin/env bash
# Prefer the durable S3 trailing-slash keys uploaded by sync-marketing-to-s3.sh
# (static_s3_upload_extensionless_keys). This script optionally attaches a
# CloudFront Function rewrite when the deploy IAM user has cloudfront:CreateFunction.
#
# If CreateFunction is denied (current rapid-cortex-deploy policy), the S3 key
# approach alone is enough — re-run: bash scripts/deploy-marketing.sh prod
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck source=scripts/lib/rapid-cortex-aws.sh
source "${ROOT}/scripts/lib/rapid-cortex-aws.sh"
# shellcheck source=scripts/lib/static-s3-hosting.sh
source "${ROOT}/scripts/lib/static-s3-hosting.sh"

export AWS_PROFILE="${AWS_PROFILE:-rapid-cortex}"
export AWS_REGION="${AWS_REGION:-us-east-1}"
rapid_cortex_assert_aws_account

DIST_ID="${MARKETING_CF_DIST_ID:-${RAPID_CORTEX_MARKETING_CF_DIST_ID:-EWZ286WS69KX1}}"
BUCKET="${MARKETING_S3_BUCKET:-${RAPID_CORTEX_MARKETING_S3_BUCKET:-rapid-cortex-v2-web-static-prod-158961537080}}"
STATIC_DIR="${ROOT}/apps/marketing/out"
FN_NAME="${MARKETING_URI_REWRITE_FN:-rapid-cortex-marketing-uri-rewrite-prod}"
FN_FILE="${ROOT}/infra/cloudfront/marketing-uri-rewrite.js"

if [[ ! -d "${STATIC_DIR}" ]]; then
  echo "Building marketing site first ..."
  bash "${ROOT}/scripts/build-marketing.sh"
fi

echo "Ensuring trailing-slash S3 keys exist on ${BUCKET} ..."
static_s3_upload_extensionless_keys "${STATIC_DIR}" "${BUCKET}" "${AWS_REGION}"

if [[ -f "${FN_FILE}" ]] && aws cloudfront create-function --generate-cli-skeleton >/dev/null 2>&1; then
  if aws cloudfront describe-function --name "${FN_NAME}" >/dev/null 2>&1; then
    echo "Updating CloudFront Function ${FN_NAME} ..."
    etag="$(aws cloudfront describe-function --name "${FN_NAME}" --query 'ETag' --output text)"
    aws cloudfront update-function \
      --name "${FN_NAME}" \
      --if-match "${etag}" \
      --function-config "Comment=Rewrite trailing-slash routes to path/index.html for S3 static export,Runtime=cloudfront-js-2.0" \
      --function-code "fileb://${FN_FILE}" >/dev/null || echo "WARN: update-function failed (IAM?); S3 keys still cover /privacy/."
  else
    echo "Creating CloudFront Function ${FN_NAME} ..."
    if ! aws cloudfront create-function \
      --name "${FN_NAME}" \
      --function-config "Comment=Rewrite trailing-slash routes to path/index.html for S3 static export,Runtime=cloudfront-js-2.0" \
      --function-code "fileb://${FN_FILE}" >/dev/null; then
      echo "WARN: create-function denied — relying on S3 trailing-slash keys only."
    fi
  fi
fi

aws cloudfront create-invalidation --distribution-id "${DIST_ID}" --paths "/*" \
  --query 'Invalidation.Id' --output text

echo "Verify:"
echo "  curl -s https://www.rapidcortex.us/privacy/ | grep -o '<title>[^<]*</title>'"
echo "  curl -s https://www.rapidcortex.us/terms/   | grep -o '<title>[^<]*</title>'"
