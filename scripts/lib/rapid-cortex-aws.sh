#!/usr/bin/env bash
# Rapid Cortex production AWS identifiers (account 158961537080).
set -euo pipefail

export RAPID_CORTEX_AWS_ACCOUNT_ID="${RAPID_CORTEX_AWS_ACCOUNT_ID:-158961537080}"
export RAPID_CORTEX_AWS_REGION="${RAPID_CORTEX_AWS_REGION:-us-east-1}"
export RAPID_CORTEX_MARKETING_CF_DIST_ID="${RAPID_CORTEX_MARKETING_CF_DIST_ID:-EWZ286WS69KX1}"
export RAPID_CORTEX_MARKETING_S3_BUCKET="${RAPID_CORTEX_MARKETING_S3_BUCKET:-rapid-cortex-v2-web-static-prod-158961537080}"

rapid_cortex_current_aws_account() {
  aws sts get-caller-identity --query Account --output text 2>/dev/null || true
}

rapid_cortex_assert_aws_account() {
  local expected="${1:-${RAPID_CORTEX_AWS_ACCOUNT_ID}}"
  local current
  current="$(rapid_cortex_current_aws_account)"
  if [[ -z "${current}" ]]; then
    echo "ERROR: AWS CLI is not authenticated. export AWS_PROFILE=rapid-cortex" >&2
    return 1
  fi
  if [[ "${current}" != "${expected}" ]]; then
    echo "ERROR: AWS account mismatch." >&2
    echo "  Current:  ${current}" >&2
    echo "  Expected: ${expected} (Rapid Cortex prod)" >&2
    echo "  Fix: export AWS_PROFILE=rapid-cortex" >&2
    return 1
  fi
}

rapid_cortex_invalidate_marketing_cloudfront() {
  local dist_id="${1:-${RAPID_CORTEX_MARKETING_CF_DIST_ID}}"
  local region="${2:-${RAPID_CORTEX_AWS_REGION}}"
  rapid_cortex_assert_aws_account
  echo "Invalidating CloudFront distribution ${dist_id} (account ${RAPID_CORTEX_AWS_ACCOUNT_ID}) paths /* …"
  aws cloudfront create-invalidation \
    --distribution-id "${dist_id}" \
    --paths "/*" \
    --region "${region}" \
    --query 'Invalidation.{Id:Id,Status:Status,CreateTime:CreateTime}' \
    --output json
}
