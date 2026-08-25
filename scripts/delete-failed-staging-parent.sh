#!/usr/bin/env bash
# Delete CREATE_FAILED parent stack rapid-cortex-staging so a clean staging deploy can run.
# Never touches rapid-cortex-dev. Empties only *-staging-* buckets this stack owns.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck source=scripts/lib/rapid-cortex-aws.sh
source "${ROOT}/scripts/lib/rapid-cortex-aws.sh"
rapid_cortex_assert_aws_account

export AWS_PROFILE="${AWS_PROFILE:-rapid-cortex}"
export AWS_REGION="${AWS_REGION:-us-east-1}"
export AWS_DEFAULT_REGION="${AWS_DEFAULT_REGION:-$AWS_REGION}"

STACK="${STAGING_STACK_NAME:-rapid-cortex-staging}"
if [[ "${STACK}" != "rapid-cortex-staging" ]]; then
  echo "ERROR: refusing to delete ${STACK} (this script only deletes rapid-cortex-staging)." >&2
  exit 1
fi

STATUS="$(aws cloudformation describe-stacks --stack-name "${STACK}" --query 'Stacks[0].StackStatus' --output text 2>/dev/null || echo MISSING)"
if [[ "${STATUS}" == "MISSING" ]]; then
  echo "Stack ${STACK} is already gone."
  exit 0
fi
if [[ "${STATUS}" != "CREATE_FAILED" && "${STATUS}" != "ROLLBACK_COMPLETE" && "${STATUS}" != "ROLLBACK_FAILED" ]]; then
  echo "ERROR: ${STACK} status is ${STATUS}, not CREATE_FAILED. Refusing to delete a healthy/in-progress stack." >&2
  exit 1
fi

echo "Emptying staging DataLayer buckets (live -dev buckets are not in this list)..."
ACCOUNT="$(aws sts get-caller-identity --query Account --output text)"
for b in \
  "rapid-cortex-assets-staging-${ACCOUNT}" \
  "rapid-cortex-billing-invoices-staging-${ACCOUNT}" \
  "rapid-cortex-billing-pos-staging-${ACCOUNT}"
do
  if aws s3api head-bucket --bucket "${b}" >/dev/null 2>&1; then
    echo "  emptying s3://${b}"
    aws s3 rm "s3://${b}" --recursive || true
  else
    echo "  skip missing s3://${b}"
  fi
done

echo "Deleting CloudFormation stack ${STACK} (${STATUS})..."
aws cloudformation delete-stack --stack-name "${STACK}"
echo "Waiting for delete (nested DataLayer + failed AppSam)..."
aws cloudformation wait stack-delete-complete --stack-name "${STACK}"
echo "Deleted ${STACK}. Billing secrets with DeletionPolicy=Retain may still exist — env-api-staging.sh passes them as Existing*."
