#!/usr/bin/env bash
set -euo pipefail
# Fix AppSamStack Cognito group drift (renamed groups + CREATE_FAILED AlreadyExists).
#
# Dev/staging: deletes and recreates the six affected pool groups, then drops stale logical
# IDs from the nested stack so the next ./scripts/deploy.sh can recreate them from template.
#
# Usage: ./scripts/reconcile-cognito-groups-cfn-import.sh [dev|staging|prod|pilot]
# Prod/pilot: set RECONCILE_COGNITO_ALLOW_PROD=1 to run (destructive to group membership).

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
STAGE="${1:-dev}"
ENV_SCRIPT="${ROOT}/scripts/env-api-${STAGE}.sh"
if [[ -f "${ENV_SCRIPT}" ]]; then
  # shellcheck source=/dev/null
  source "${ENV_SCRIPT}"
fi
AWS_REGION="${AWS_REGION:-${AWS_DEFAULT_REGION:-us-east-1}}"
APP_NAME="${APP_NAME:-rapid-cortex}"
STACK_NAME="${STACK_NAME:-${APP_NAME}-${STAGE}}"
SAM_DEPLOY_BUCKET="${SAM_DEPLOY_BUCKET:-aws-sam-cli-managed-default-samclisourcebucket-cytgt6pjll2k}"

# Groups that exist in Cognito but CloudFormation stack state is out of sync.
AFFECTED_GROUP_NAMES=(
  rcadmin
  rcitadmin
  auditor
  rcsuperadmin
  agencyadmin
  commsupervisor
)
# Logical IDs to remove from the nested stack template (re-created on next deploy).
REMOVE_LOGICAL_IDS=(
  CognitoGroupRcBusinessAdmin
  CognitoGroupRcItAdmin
  CognitoGroupAuditor
  CognitoGroupPlatformSuperadmin
  CognitoGroupAgencyAdmin
  CognitoGroupSupervisor
  CognitoGroupReadonlyAuditor
)

if [[ "${STAGE}" == "prod" || "${STAGE}" == "pilot" ]] && [[ "${RECONCILE_COGNITO_ALLOW_PROD:-0}" != "1" ]]; then
  echo "❌ Refusing to delete/recreate Cognito groups in ${STAGE} without RECONCILE_COGNITO_ALLOW_PROD=1." >&2
  exit 1
fi

if ! command -v jq &>/dev/null; then
  echo "❌ jq is required (brew install jq)." >&2
  exit 1
fi

NESTED_STACK_ID="$(
  aws cloudformation describe-stack-resources \
    --stack-name "${STACK_NAME}" \
    --region "${AWS_REGION}" \
    --logical-resource-id AppSamStack \
    --query 'StackResources[0].PhysicalResourceId' \
    --output text 2>/dev/null || true
)"
if [[ -z "${NESTED_STACK_ID}" || "${NESTED_STACK_ID}" == "None" ]]; then
  echo "❌ Could not resolve AppSamStack nested stack for ${STACK_NAME}." >&2
  exit 1
fi

USER_POOL_ID="$(
  aws cloudformation describe-stack-resource \
    --stack-name "${NESTED_STACK_ID}" \
    --logical-resource-id CognitoUserPool \
    --region "${AWS_REGION}" \
    --query 'StackResourceDetail.PhysicalResourceId' \
    --output text 2>/dev/null || true
)"
if [[ -z "${USER_POOL_ID}" || "${USER_POOL_ID}" == "None" ]]; then
  echo "❌ Could not resolve Cognito UserPoolId." >&2
  exit 1
fi

WORK="$(mktemp -d)"
trap 'rm -rf "${WORK}"' EXIT

echo "→ Nested stack: ${NESTED_STACK_ID}"
echo "→ User pool:    ${USER_POOL_ID}"
echo "→ Deleting drifted Cognito groups (membership in these groups is cleared) …"
for group_name in "${AFFECTED_GROUP_NAMES[@]}"; do
  if aws cognito-idp get-group \
    --user-pool-id "${USER_POOL_ID}" \
    --group-name "${group_name}" \
    --region "${AWS_REGION}" &>/dev/null; then
    aws cognito-idp delete-group \
      --user-pool-id "${USER_POOL_ID}" \
      --group-name "${group_name}" \
      --region "${AWS_REGION}"
    echo "   deleted ${group_name}"
  else
    echo "   skip ${group_name} (not in pool)"
  fi
done

echo "→ Building nested stack template without stale group logical IDs …"
aws cloudformation get-template \
  --stack-name "${NESTED_STACK_ID}" \
  --region "${AWS_REGION}" \
  --template-stage Processed \
  --output json \
  | jq '.TemplateBody' >"${WORK}/processed.json"

for logical_id in "${REMOVE_LOGICAL_IDS[@]}"; do
  jq --arg id "${logical_id}" 'del(.Resources[$id])' "${WORK}/processed.json" >"${WORK}/processed-next.json"
  mv "${WORK}/processed-next.json" "${WORK}/processed.json"
done

aws cloudformation describe-stacks \
  --stack-name "${NESTED_STACK_ID}" \
  --region "${AWS_REGION}" \
  --output json \
  | jq '[.Stacks[0].Parameters[] | {ParameterKey, ParameterValue: (.ParameterValue // "")}]' \
    >"${WORK}/parameters.json"

ts="$(date +%s)"
s3_key="cfn-import/${STAGE}/strip-cognito-groups-${ts}.json"
aws s3 cp "${WORK}/processed.json" "s3://${SAM_DEPLOY_BUCKET}/${s3_key}" --region "${AWS_REGION}" >/dev/null
template_url="https://${SAM_DEPLOY_BUCKET}.s3.${AWS_REGION}.amazonaws.com/${s3_key}"
change_name="rc-cognito-strip-${ts}"

NESTED_STATUS="$(
  aws cloudformation describe-stacks \
    --stack-name "${NESTED_STACK_ID}" \
    --region "${AWS_REGION}" \
    --query 'Stacks[0].StackStatus' \
    --output text
)"
echo "→ UPDATE nested stack (${NESTED_STATUS}; remove stale Cognito group logical IDs) …"
update_args=(
  --stack-name "${NESTED_STACK_ID}"
  --region "${AWS_REGION}"
  --template-url "${template_url}"
  --parameters "file://${WORK}/parameters.json"
  --capabilities CAPABILITY_IAM CAPABILITY_NAMED_IAM CAPABILITY_AUTO_EXPAND
)
if [[ "${NESTED_STATUS}" == *"FAILED"* ]]; then
  update_args+=(--disable-rollback)
fi
aws cloudformation update-stack "${update_args[@]}" >/dev/null

aws cloudformation wait stack-update-complete \
  --stack-name "${NESTED_STACK_ID}" \
  --region "${AWS_REGION}"

NESTED_STATUS="$(
  aws cloudformation describe-stacks \
    --stack-name "${NESTED_STACK_ID}" \
    --region "${AWS_REGION}" \
    --query 'Stacks[0].StackStatus' \
    --output text
)"
echo "✅ Nested stack ${NESTED_STATUS}. Run deploy to recreate groups from template:"
echo "   source scripts/env-api-${STAGE}.sh && ./scripts/deploy.sh ${STAGE}"
