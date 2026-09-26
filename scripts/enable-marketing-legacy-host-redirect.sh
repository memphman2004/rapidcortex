#!/usr/bin/env bash
# Phase B: attach host-based 301 on the dual-brand marketing CloudFront.
#
#   rapidcortex.us / www.rapidcortex.us → https://www.nexcortiq.us{path}{query}
#   nexcortiq.us (apex) → https://www.nexcortiq.us{path}{query}
#   www.nexcortiq.us unchanged (serves site)
#   app.rapidcortex.us untouched (different distribution)
#
# Why not infra/rapidcortex-us-redirect.yaml?
# That stack creates a NEW distribution claiming the same CNAMEs. Live marketing
# dist EWZ286WS69KX1 already owns rapidcortex.us + nexcortiq.us aliases, so CFN
# fails with CNAMEAlreadyExists. Host-conditional function on the existing dist
# is the correct cutover path.
#
# Usage (needs cloudfront:CreateFunction — deploy IAM user lacks it):
#   AWS_PROFILE=default bash scripts/enable-marketing-legacy-host-redirect.sh
#   # or:
#   CF_ADMIN_PROFILE=default bash scripts/enable-marketing-legacy-host-redirect.sh
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck source=scripts/lib/rapid-cortex-aws.sh
source "${ROOT}/scripts/lib/rapid-cortex-aws.sh"

if [[ -n "${CF_ADMIN_PROFILE:-}" ]]; then
  export AWS_PROFILE="${CF_ADMIN_PROFILE}"
elif [[ -z "${AWS_PROFILE:-}" ]]; then
  export AWS_PROFILE="rapid-cortex"
fi
export AWS_REGION="${AWS_REGION:-us-east-1}"
rapid_cortex_assert_aws_account
echo "Using AWS_PROFILE=${AWS_PROFILE} ($(aws sts get-caller-identity --query Arn --output text))"

DIST_ID="${MARKETING_CF_DIST_ID:-${RAPID_CORTEX_MARKETING_CF_DIST_ID:-EWZ286WS69KX1}}"
FN_NAME="${MARKETING_LEGACY_REDIRECT_FN:-nexcortiq-marketing-legacy-host-redirect}"
FN_FILE="${ROOT}/infra/cloudfront/marketing-legacy-host-redirect.js"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "${TMP_DIR}"' EXIT

if [[ ! -f "${FN_FILE}" ]]; then
  echo "Missing ${FN_FILE}" >&2
  exit 1
fi

echo "Publishing CloudFront Function ${FN_NAME} ..."
if aws cloudfront describe-function --name "${FN_NAME}" >/dev/null 2>&1; then
  etag="$(aws cloudfront describe-function --name "${FN_NAME}" --query 'ETag' --output text)"
  aws cloudfront update-function \
    --name "${FN_NAME}" \
    --if-match "${etag}" \
    --function-config "Comment=301 rapidcortex.us(+www) and nexcortiq.us apex to www.nexcortiq.us; URI rewrite for static export,Runtime=cloudfront-js-2.0" \
    --function-code "fileb://${FN_FILE}" >/dev/null
else
  aws cloudfront create-function \
    --name "${FN_NAME}" \
    --function-config "Comment=301 rapidcortex.us(+www) and nexcortiq.us apex to www.nexcortiq.us; URI rewrite for static export,Runtime=cloudfront-js-2.0" \
    --function-code "fileb://${FN_FILE}" >/dev/null
fi

PUB_ETAG="$(aws cloudfront describe-function --name "${FN_NAME}" --query 'ETag' --output text)"
aws cloudfront publish-function --name "${FN_NAME}" --if-match "${PUB_ETAG}" >/dev/null
FN_ARN="$(aws cloudfront describe-function --name "${FN_NAME}" --query 'FunctionSummary.FunctionMetadata.FunctionARN' --output text)"
echo "Function ARN: ${FN_ARN}"

echo "Associating viewer-request on distribution ${DIST_ID} ..."
aws cloudfront get-distribution-config --id "${DIST_ID}" >"${TMP_DIR}/dist.json"
ETAG="$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["ETag"])' "${TMP_DIR}/dist.json")"
python3 - "${TMP_DIR}/dist.json" "${FN_ARN}" "${TMP_DIR}/config.json" <<'PY'
import json, sys
src, fn_arn, out = sys.argv[1:4]
raw = json.load(open(src))
cfg = raw["DistributionConfig"]
assoc = {
    "Quantity": 1,
    "Items": [
        {
            "EventType": "viewer-request",
            "FunctionARN": fn_arn,
        }
    ],
}
cfg["DefaultCacheBehavior"]["FunctionAssociations"] = assoc
# Keep Comment accurate for ops
cfg["Comment"] = "NexCort iQ marketing (legacy Rapid Cortex hosts 301 → www.nexcortiq.us)"
json.dump(cfg, open(out, "w"))
PY

aws cloudfront update-distribution \
  --id "${DIST_ID}" \
  --if-match "${ETAG}" \
  --distribution-config "file://${TMP_DIR}/config.json" \
  --query 'Distribution.{Id:Id,Status:Status,LastModified:LastModifiedTime}' \
  --output json

echo "Creating invalidation ..."
aws cloudfront create-invalidation --distribution-id "${DIST_ID}" --paths "/*" \
  --query 'Invalidation.Id' --output text

echo ""
echo "Wait ~1–3 min for CF deploy, then verify:"
echo "  curl -sI https://www.rapidcortex.us/pricing | head -5"
echo "  curl -sI 'https://www.rapidcortex.us/pricing?x=1' | head -5"
echo "  curl -sI https://www.nexcortiq.us/pricing | head -5"
echo "  curl -sI https://app.rapidcortex.us/ | head -5"
