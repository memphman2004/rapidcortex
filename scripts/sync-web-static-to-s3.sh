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

# S3 + CloudFront serve object keys literally (/enter → key "enter", not enter.html).
# Next static export emits enter.html (+ enter/ metadata dir). Without an extensionless key,
# /enter 404s and CustomErrorResponse serves index.html (homepage).
echo "Preparing trailing-slash static routes in ${STATIC_DIR} ..."
declare -a EXTENSIONLESS_ROUTE_HTML=()
for html_file in "${STATIC_DIR}"/*.html; do
  [[ -f "${html_file}" ]] || continue
  route_name="$(basename "${html_file}" .html)"
  if [[ "${route_name}" == "index" || "${route_name}" == "404" ]]; then
    continue
  fi
  mkdir -p "${STATIC_DIR}/${route_name}"
  cp "${html_file}" "${STATIC_DIR}/${route_name}/index.html"
  EXTENSIONLESS_ROUTE_HTML+=("${html_file}")
done

echo "Syncing ${STATIC_DIR} to s3://${BUCKET} ..."
aws s3 sync "${STATIC_DIR}" "s3://${BUCKET}/" --delete

if [[ ${#EXTENSIONLESS_ROUTE_HTML[@]} -gt 0 ]]; then
  echo "Uploading extensionless S3 keys for clean URLs (/enter, /pricing, …) ..."
  for html_file in "${EXTENSIONLESS_ROUTE_HTML[@]}"; do
    route_name="$(basename "${html_file}" .html)"
    aws s3 cp "${html_file}" "s3://${BUCKET}/${route_name}" \
      --content-type "text/html; charset=utf-8" \
      --cache-control "public, max-age=0, must-revalidate"
  done
fi

DIST_ID="${CLOUDFRONT_DISTRIBUTION_ID:-$(
  aws cloudformation describe-stacks \
    --stack-name "${WEB_HOSTING_STACK_NAME}" \
    --region "${AWS_REGION}" \
    --query "Stacks[0].Outputs[?OutputKey=='CloudFrontDistributionId'].OutputValue | [0]" \
    --output text
)}"

if [[ -n "${DIST_ID}" && "${DIST_ID}" != "None" ]]; then
  echo "Invalidating CloudFront ${DIST_ID} ..."
  aws cloudfront create-invalidation \
    --region "${AWS_REGION}" \
    --distribution-id "${DIST_ID}" \
    --paths "/*"
else
  echo "No CloudFront distribution id; skip invalidation."
fi

echo "Done. Site: https://www.rapidcortex.us (after DNS and cert are active)."
