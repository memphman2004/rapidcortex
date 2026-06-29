#!/usr/bin/env bash
# Compare AppSam4 CloudFormation inventory vs physical Ring Lambdas and HTTP API routes.
# Run after AppSam4 deploy to confirm routes target template-owned functions (not orphans).
#
# Usage:
#   ./scripts/audit-appsam4-ring-drift.sh [dev]
#   ADMIN_AWS_PROFILE=admin ./scripts/audit-appsam4-ring-drift.sh dev --detect-drift
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
STAGE="${1:-dev}"
DETECT_DRIFT=0
for arg in "$@"; do
  case "${arg}" in
    --detect-drift) DETECT_DRIFT=1 ;;
  esac
done

AWS_REGION="${AWS_REGION:-us-east-1}"
STACK_NAME="${STACK_NAME:-rapid-cortex-${STAGE}}"
APP4_STACK="$(aws cloudformation describe-stack-resources \
  --stack-name "${STACK_NAME}" \
  --region "${AWS_REGION}" \
  --query "StackResources[?LogicalResourceId=='AppSam4Stack'].PhysicalResourceId" \
  --output text 2>/dev/null | awk -F/ '{print $(NF-1)}')"

if [[ -z "${APP4_STACK}" || "${APP4_STACK}" == "None" ]]; then
  echo "ERROR: AppSam4Stack not found under ${STACK_NAME}" >&2
  exit 1
fi

echo "════════════════════════════════════════════════════════"
echo " AppSam4 Ring drift audit (stage=${STAGE})"
echo " Nested stack: ${APP4_STACK}"
echo "════════════════════════════════════════════════════════"

echo ""
echo "── CFN Lambda resources (Ring* logical IDs) ──"
CFN_RING="$(aws cloudformation list-stack-resources \
  --stack-name "${APP4_STACK}" \
  --region "${AWS_REGION}" \
  --query 'StackResourceSummaries[?ResourceType==`AWS::Lambda::Function` && contains(LogicalResourceId, `Ring`)].{Logical:LogicalResourceId,Physical:PhysicalResourceId}' \
  --output json \
  --no-cli-pager)"
echo "${CFN_RING}" | python3 -c "import json,sys; r=json.load(sys.stdin); print(f'count={len(r)}'); [print(f\"  {x['Logical']} -> {x['Physical']}\") for x in r]"

echo ""
echo "── Physical AWS Lambdas (AppSam4S-Ring*) ──"
PHYSICAL="$(aws lambda list-functions --region "${AWS_REGION}" \
  --query 'Functions[?contains(FunctionName, `AppSam4S-Ring`)].FunctionArn' --output text)"
echo "${PHYSICAL}" | tr '\t' '\n' | sed 's/^/  /'

echo ""
echo "── HTTP API routes (ring + public on stack 4 API) ──"
API_ID="$(aws cloudformation describe-stacks --stack-name "${APP4_STACK}" --region "${AWS_REGION}" \
  --query "Stacks[0].Outputs[?OutputKey=='HttpApiId'].OutputValue" --output text 2>/dev/null)"
if [[ -z "${API_ID}" || "${API_ID}" == "None" ]]; then
  API_ID="$(aws cloudformation describe-stack-resources \
    --stack-name "${APP4_STACK}" \
    --region "${AWS_REGION}" \
    --query "StackResources[?ResourceType=='AWS::ApiGatewayV2::Api'].PhysicalResourceId" \
    --output text 2>/dev/null | head -1)"
fi
if [[ -n "${API_ID}" && "${API_ID}" != "None" ]]; then
  aws apigatewayv2 get-routes --api-id "${API_ID}" --region "${AWS_REGION}" \
    --query 'Items[?contains(RouteKey, `ring`) || contains(RouteKey, `public`)].RouteKey' \
    --output text | tr '\t' '\n' | sed 's/^/  /'
else
  echo "  (HttpApi id not resolved from stack — check API 7c70vqd1p5 manually)"
fi

if [[ "${DETECT_DRIFT}" -eq 1 ]]; then
  echo ""
  echo "── CloudFormation detect-stack-drift (requires admin) ──"
  DRIFT_ID="$(aws cloudformation detect-stack-drift --stack-name "${APP4_STACK}" --region "${AWS_REGION}" --query StackDriftDetectionId --output text)"
  echo "  Detection id: ${DRIFT_ID}"
  aws cloudformation wait stack-drift-detection-complete --stack-drift-detection-id "${DRIFT_ID}" --region "${AWS_REGION}"
  aws cloudformation describe-stack-drift-detection-status --stack-drift-detection-id "${DRIFT_ID}" --region "${AWS_REGION}" \
    --query '{Status:DetectionStatus,Drifted:StackResourceDriftStatus,Reason:DetectionStatusReason}' --output table
fi

echo ""
echo "Review: CFN Ring Lambda count should match routes; physical orphans not in CFN need import or retirement."
