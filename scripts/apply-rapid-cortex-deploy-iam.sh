#!/usr/bin/env bash
# Apply deploy-gap IAM for rapid-cortex-deploy (CloudFront invalidation, CodeBuild, ECS describe, Mapbox SSM).
# Requires an admin principal — rapid-cortex-deploy cannot attach its own policies.
#
# Usage:
#   ADMIN_AWS_PROFILE=your-admin-profile ./scripts/apply-rapid-cortex-deploy-iam.sh
#   ./scripts/apply-rapid-cortex-deploy-iam.sh --invalidate-marketing   # also invalidate /security + /trust
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
POLICY_FILE="${ROOT}/infra/iam/rapid-cortex-deploy-policy.prod.json"
IAM_USER="rapid-cortex-deploy"
POLICY_NAME="rapid-cortex-deploy-gaps"
MARKETING_DIST_ID="EWZ286WS69KX1"
REGION="${AWS_REGION:-us-east-1}"
INVALIDATE=0

for arg in "$@"; do
  case "${arg}" in
  --invalidate-marketing) INVALIDATE=1 ;;
  --help | -h)
    sed -n '2,8p' "$0"
    exit 0
    ;;
  *)
    echo "Unknown argument: ${arg}" >&2
    exit 1
    ;;
  esac
done

if [[ ! -f "${POLICY_FILE}" ]]; then
  echo "ERROR: Missing ${POLICY_FILE}" >&2
  exit 1
fi

if [[ -n "${ADMIN_AWS_PROFILE:-}" ]]; then
  export AWS_PROFILE="${ADMIN_AWS_PROFILE}"
fi

echo "Applying IAM inline policy ${POLICY_NAME} to user ${IAM_USER} …"
aws iam put-user-policy \
  --user-name "${IAM_USER}" \
  --policy-name "${POLICY_NAME}" \
  --policy-document "file://${POLICY_FILE}"

echo "Verifying policy document attached …"
aws iam get-user-policy \
  --user-name "${IAM_USER}" \
  --policy-name "${POLICY_NAME}" \
  --query 'PolicyDocument.Statement[*].Sid' \
  --output text

if [[ "${INVALIDATE}" -eq 1 ]]; then
  echo "Invalidating marketing CloudFront (${MARKETING_DIST_ID}) for /security and /trust …"
  aws cloudfront create-invalidation \
    --distribution-id "${MARKETING_DIST_ID}" \
    --paths "/security" "/security/*" "/trust" "/trust/*" \
    --region "${REGION}"
fi

echo "Done. Re-run deploys with AWS_PROFILE=rapid-cortex."
