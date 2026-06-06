#!/usr/bin/env bash
# Run AFTER ./scripts/deploy.sh dev succeeds (new CognitoUserPool from AppSamStack).
# Adds custom attributes + groups that are omitted from CFN Schema (immutable after create).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
STAGE="${1:-dev}"
STACK_NAME="${STACK_NAME:-rapid-cortex-${STAGE}}"
AWS_REGION="${AWS_REGION:-us-east-1}"

USER_POOL_ID="${COGNITO_USER_POOL_ID:-$(
  aws cloudformation describe-stacks \
    --stack-name "${STACK_NAME}" \
    --region "${AWS_REGION}" \
    --query 'Stacks[0].Outputs[?OutputKey==`UserPoolId`].OutputValue' \
    --output text
)}"

if [[ -z "${USER_POOL_ID}" || "${USER_POOL_ID}" == "None" ]]; then
  echo "ERROR: Could not resolve UserPoolId from stack ${STACK_NAME}. Export COGNITO_USER_POOL_ID or fix stack." >&2
  exit 1
fi

echo "→ User pool: ${USER_POOL_ID}"

add_attr() {
  local name="$1"
  echo "  + custom:${name}"
  aws cognito-idp add-custom-attributes \
    --user-pool-id "${USER_POOL_ID}" \
    --region "${AWS_REGION}" \
    --custom-attributes "Name=${name},AttributeDataType=String,Mutable=true" \
    2>/dev/null || echo "    (skip — may already exist)"
}

echo "→ Custom attributes (match pre-incident pool)"
for attr in agencyId role status planId subStatus pwdChangedAt pwdChangeReq hospitalId; do
  add_attr "${attr}"
done

create_group() {
  local name="$1"
  local desc="$2"
  aws cognito-idp create-group \
    --user-pool-id "${USER_POOL_ID}" \
    --group-name "${name}" \
    --description "${desc}" \
    --region "${AWS_REGION}" \
    2>/dev/null || echo "  skip group ${name} (exists?)"
}

echo "→ Cognito groups"
create_group rcsuperadmin "Rapid Cortex platform super-administrator"
create_group rcadmin "Rapid Cortex business operations"
create_group rcitadmin "Rapid Cortex technical support"
create_group agencyadmin "Agency-scoped administrators"
create_group agencyit "Agency IT administrators"
create_group commsupervisor "Agency communications supervisors"
create_group dispatcher "Agency-scoped dispatch operators"
create_group analyst "Analyst role"
create_group auditor "Read-only auditor"
create_group hospitaladmin "Hospital facility administrator"
create_group hospitalstaff "Hospital staff"

echo "→ Outputs for env updates"
aws cloudformation describe-stacks \
  --stack-name "${STACK_NAME}" \
  --region "${AWS_REGION}" \
  --query 'Stacks[0].Outputs[?contains(OutputKey,`UserPool`) || contains(OutputKey,`Cognito`) || OutputKey==`HttpApiUrl` || OutputKey==`ApiCustomDomainUrl`]' \
  --output table

echo "✅ Post-deploy Cognito setup done. Next:"
echo "   1. Update scripts/env-web-ssr-prod.sh with UserPoolId + UserPoolClientId"
echo "   2. ./scripts/deploy-web-no-docker.sh prod"
echo "   3. ./scripts/deploy2.sh dev"
echo "   4. ./scripts/add-missing-test-users.sh  (or your admin seed scripts)"
