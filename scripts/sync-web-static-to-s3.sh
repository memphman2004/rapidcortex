#!/usr/bin/env bash
# Upload a local static build to the web hosting S3 bucket and invalidate CloudFront.
# Run after: cd apps/web && npx --yes open-next@latest build  (or your static export to ./out)
#
# Required:
#   S3_BUCKET   — from stack output WebBucketName, or
#   WEB_HOSTING_STACK_NAME — we resolve bucket + distribution from CloudFormation
#
# Optional:
#   STATIC_DIR=apps/web/out  (or path to static files; must contain index.html at root)
#   AWS_PROFILE, AWS_REGION (us-east-1 for stack lookup)
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
# shellcheck source=scripts/lib/static-s3-hosting.sh
source "${ROOT}/scripts/lib/static-s3-hosting.sh"

export AWS_REGION="${AWS_REGION:-us-east-1}"
export AWS_DEFAULT_REGION="${AWS_REGION}"

STATIC_DIR="${STATIC_DIR:-${ROOT}/apps/web/out}"
APP_NAME="${APP_NAME:-rapid-cortex}"
DEPLOYMENT_STAGE="${DEPLOYMENT_STAGE:-prod}"
WEB_HOSTING_STACK_NAME="${WEB_HOSTING_STACK_NAME:-${APP_NAME}-web-hosting-${DEPLOYMENT_STAGE}}"

if [[ -n "${S3_BUCKET:-}" ]]; then
  BUCKET="${S3_BUCKET}"
else
  BUCKET="$(
    aws cloudformation describe-stacks \
      --stack-name "${WEB_HOSTING_STACK_NAME}" \
      --region "${AWS_REGION}" \
      --query "Stacks[0].Outputs[?OutputKey=='WebBucketName'].OutputValue | [0]" \
      --output text
  )"
fi

if [[ -z "${BUCKET}" || "${BUCKET}" == "None" ]]; then
  echo "Could not resolve S3 bucket. Set S3_BUCKET or deploy: scripts/deploy-web-hosting.sh" >&2
  exit 1
fi

if [[ ! -f "${STATIC_DIR}/index.html" ]]; then
  echo "No index.html in ${STATIC_DIR}. Build a static site first (e.g. next export to apps/web/out)." >&2
  exit 1
fi

static_s3_verify_local_css_refs "${STATIC_DIR}"
static_s3_prepare_root_html_dirs "${STATIC_DIR}"

static_s3_sync_two_pass "${STATIC_DIR}" "${BUCKET}" "${AWS_REGION}"
static_s3_upload_extensionless_keys "${STATIC_DIR}" "${BUCKET}" "${AWS_REGION}"
static_s3_verify_remote_deploy "${STATIC_DIR}" "${BUCKET}" "${AWS_REGION}" enter demo pricing

DIST_ID="${CLOUDFRONT_DISTRIBUTION_ID:-$(
  aws cloudformation describe-stacks \
    --stack-name "${WEB_HOSTING_STACK_NAME}" \
    --region "${AWS_REGION}" \
    --query "Stacks[0].Outputs[?OutputKey=='CloudFrontDistributionId'].OutputValue | [0]" \
    --output text
)}"

if [[ -n "${DIST_ID}" && "${DIST_ID}" != "None" ]]; then
  static_s3_invalidate_cloudfront "${DIST_ID}" "${AWS_REGION}"
else
  echo "No CloudFront distribution id; skip invalidation."
fi

echo "Done. Site: https://www.rapidcortex.us (after DNS and cert are active)."
