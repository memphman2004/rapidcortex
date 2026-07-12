#!/usr/bin/env bash
# recover-appsam5-rollback.sh
#
# Unsticks AppSam5 from UPDATE_ROLLBACK_FAILED and re-deploys the Live Video
# longevity roles (lv-inc / lv-pub) + KvsWebRtcBrowserTokenRole ArnEquals trust.
#
# IMPORTANT: CFN stack rapid-cortex-dev / DeploymentStage=dev IS production
# (account 158961537080). Role suffixes like -dev are the live prod names.
#
# Requires an ADMIN profile on account 158961537080 (rapid-cortex-deploy alone
# cannot iam:UpdateAssumeRolePolicy or cloudformation:ContinueUpdateRollback
# until this script attaches the updated gaps policy).
#
# Usage:
#   ADMIN_AWS_PROFILE=<admin> bash scripts/recover-appsam5-rollback.sh
#   ADMIN_AWS_PROFILE=<admin> bash scripts/recover-appsam5-rollback.sh --deploy
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck source=scripts/lib/rapid-cortex-aws.sh
source "${ROOT}/scripts/lib/rapid-cortex-aws.sh"

REGION="${AWS_REGION:-us-east-1}"
ROOT_STACK="${ROOT_STACK:-rapid-cortex-dev}"
IAM_USER="${IAM_USER:-rapid-cortex-deploy}"
POLICY_NAME="${POLICY_NAME:-rapid-cortex-deploy-gaps}"
POLICY_FILE="${ROOT}/infra/iam/rapid-cortex-deploy-policy.prod.json"
DO_DEPLOY=0

for arg in "$@"; do
  case "${arg}" in
  --deploy) DO_DEPLOY=1 ;;
  --help | -h)
    sed -n '2,16p' "$0"
    exit 0
    ;;
  *)
    echo "Unknown argument: ${arg}" >&2
    exit 1
    ;;
  esac
done

if [[ -z "${ADMIN_AWS_PROFILE:-}" ]]; then
  echo "ERROR: Set ADMIN_AWS_PROFILE to an admin IAM user/role in account ${RAPID_CORTEX_AWS_ACCOUNT_ID}." >&2
  exit 1
fi

export AWS_PROFILE="${ADMIN_AWS_PROFILE}"
export AWS_REGION="${REGION}"

current="$(rapid_cortex_current_aws_account)"
if [[ "${current}" != "${RAPID_CORTEX_AWS_ACCOUNT_ID}" ]]; then
  echo "ERROR: Admin credentials must target ${RAPID_CORTEX_AWS_ACCOUNT_ID} (current: ${current})." >&2
  exit 1
fi

echo "=== 1) Attach deploy gaps policy (${POLICY_NAME}) to ${IAM_USER} ==="
aws iam put-user-policy \
  --user-name "${IAM_USER}" \
  --policy-name "${POLICY_NAME}" \
  --policy-document "file://${POLICY_FILE}"
aws iam get-user-policy \
  --user-name "${IAM_USER}" \
  --policy-name "${POLICY_NAME}" \
  --query 'PolicyDocument.Statement[?Sid==`RapidCortexDeployManagedPolicyLifecycle` || Sid==`RapidCortexContinueUpdateRollback`].Sid' \
  --output text

SAM5="$(aws cloudformation describe-stack-resources \
  --stack-name "${ROOT_STACK}" \
  --region "${REGION}" \
  --query "StackResources[?LogicalResourceId=='AppSam5Stack'].PhysicalResourceId" \
  --output text)"
if [[ -z "${SAM5}" || "${SAM5}" == "None" ]]; then
  SAM5="rapid-cortex-dev-AppSam5Stack-1T38GG051RWIG"
  echo "WARN: could not resolve AppSam5Stack from ${ROOT_STACK}; using ${SAM5}"
fi

STATUS="$(aws cloudformation describe-stacks --stack-name "${SAM5}" --region "${REGION}" \
  --query 'Stacks[0].StackStatus' --output text)"
echo "AppSam5: ${SAM5} (${STATUS})"

echo "=== 2) Continue update rollback (skip KvsWebRtcBrowserTokenRole if needed) ==="
if [[ "${STATUS}" == "UPDATE_ROLLBACK_FAILED" ]]; then
  # Prefer skip so rollback can complete even if trust update is still blocked mid-flight.
  if ! aws cloudformation continue-update-rollback \
    --stack-name "${SAM5}" \
    --region "${REGION}" \
    --resources-to-skip KvsWebRtcBrowserTokenRole 2>/tmp/appsam5-cur.err; then
    cat /tmp/appsam5-cur.err >&2
    echo "Retrying without ResourcesToSkip…"
    aws cloudformation continue-update-rollback \
      --stack-name "${SAM5}" \
      --region "${REGION}"
  fi

  echo "Waiting for UPDATE_ROLLBACK_COMPLETE…"
  aws cloudformation wait stack-rollback-complete --stack-name "${SAM5}" --region "${REGION}" \
    || aws cloudformation describe-stacks --stack-name "${SAM5}" --region "${REGION}" \
      --query 'Stacks[0].[StackStatus,StackStatusReason]' --output text
else
  echo "Stack is not UPDATE_ROLLBACK_FAILED — skipping continue-update-rollback."
fi

STATUS="$(aws cloudformation describe-stacks --stack-name "${SAM5}" --region "${REGION}" \
  --query 'Stacks[0].StackStatus' --output text)"
echo "AppSam5 status now: ${STATUS}"

if [[ "${DO_DEPLOY}" -eq 1 ]]; then
  echo "=== 3) Lean AppSam5 redeploy (as rapid-cortex-deploy) ==="
  export AWS_PROFILE=rapid-cortex
  # shellcheck disable=SC1091
  source "${ROOT}/scripts/env-api-dev.sh"
  export ENABLE_SILENT_TEXT=true ENABLE_LIVE_VIDEO_RESOURCES=true SAM_BUILD_USE_CACHE=1
  bash "${ROOT}/scripts/deploy-lean-dev.sh" --sam5-only
else
  echo ""
  echo "Policy attached and rollback continue requested."
  echo "When status is UPDATE_ROLLBACK_COMPLETE / UPDATE_COMPLETE, redeploy with:"
  echo "  source scripts/env-api-dev.sh"
  echo "  export ENABLE_SILENT_TEXT=true ENABLE_LIVE_VIDEO_RESOURCES=true SAM_BUILD_USE_CACHE=1"
  echo "  AWS_PROFILE=rapid-cortex ./scripts/deploy-lean-dev.sh --sam5-only"
  echo ""
  echo "Or re-run: ADMIN_AWS_PROFILE=${ADMIN_AWS_PROFILE} bash scripts/recover-appsam5-rollback.sh --deploy"
fi
