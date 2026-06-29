#!/usr/bin/env bash
# Apply deploy-gap IAM for rapid-cortex-deploy (ECS, CodeBuild, ECR, Mapbox SSM).
# Prefer split managed policies: scripts/apply-sam-deploy-managed-policies.sh
#   (infra/iam/sam-deploy-policy.prod.json + sam-deploy-policy-web.prod.json)
# This inline policy is legacy overlap — attach managed policies first.
#
# Usage:
#   ADMIN_AWS_PROFILE=<admin-on-158961537080> ./scripts/apply-rapid-cortex-deploy-iam.sh
#   ADMIN_AWS_PROFILE=<admin-on-158961537080> ./scripts/apply-rapid-cortex-deploy-iam.sh --invalidate-marketing
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck source=scripts/lib/rapid-cortex-aws.sh
source "${ROOT}/scripts/lib/rapid-cortex-aws.sh"

POLICY_FILE="${ROOT}/infra/iam/rapid-cortex-deploy-policy.prod.json"
IAM_USER="rapid-cortex-deploy"
POLICY_NAME="rapid-cortex-deploy-gaps"
INVALIDATE=0

for arg in "$@"; do
  case "${arg}" in
  --invalidate-marketing) INVALIDATE=1 ;;
  --help | -h)
    sed -n '2,10p' "$0"
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

export AWS_REGION="${AWS_REGION:-${RAPID_CORTEX_AWS_REGION}}"

current="$(rapid_cortex_current_aws_account)"
if [[ -z "${current}" ]]; then
  echo "ERROR: AWS CLI is not authenticated." >&2
  exit 1
fi
if [[ "${current}" != "${RAPID_CORTEX_AWS_ACCOUNT_ID}" ]]; then
  echo "ERROR: Admin credentials must target Rapid Cortex prod account ${RAPID_CORTEX_AWS_ACCOUNT_ID} (current: ${current})." >&2
  echo "Set ADMIN_AWS_PROFILE to an IAM user/role in account ${RAPID_CORTEX_AWS_ACCOUNT_ID}." >&2
  exit 1
fi

echo "Applying IAM inline policy ${POLICY_NAME} to user ${IAM_USER} (account ${RAPID_CORTEX_AWS_ACCOUNT_ID}) …"
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
  rapid_cortex_invalidate_marketing_cloudfront
fi

echo "Done. Marketing deploys: AWS_PROFILE=rapid-cortex bash scripts/deploy-marketing.sh prod"
