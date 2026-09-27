#!/usr/bin/env bash
# Surgical Features stack deploy for dev — creates AgencyAiGateTable + AiGate routes on AppSam2 HttpApi.
# Prefer this over a full monolith deploy when only Features / AI gate is needed.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

export AWS_PROFILE="${AWS_PROFILE:-rapid-cortex}"
export AWS_REGION="${AWS_REGION:-us-east-1}"
export AWS_SDK_LOAD_CONFIG=1
unset HTTP_PROXY HTTPS_PROXY http_proxy https_proxy ALL_PROXY all_proxy || true

STAGE="${STAGE:-dev}"
APP_NAME="${APP_NAME:-rapid-cortex}"
STACK_NAME="${FEATURES_STACK_NAME:-rapid-cortex-features-${STAGE}}"
SAM_BUILD_DIR="${SAM_BUILD_DIR:-${HOME}/.rapid-cortex-sam-build/features-${STAGE}}"
mkdir -p "${SAM_BUILD_DIR}"

echo "── Resolve parent stack outputs (rapid-cortex-${STAGE}) ──"
PARENT="rapid-cortex-${STAGE}"
out() {
  aws cloudformation describe-stacks --stack-name "$PARENT" \
    --query "Stacks[0].Outputs[?OutputKey=='$1'].OutputValue" --output text --region "${AWS_REGION}"
}
HTTP_API_ID="$(out HttpApi2Id)"
if [[ -z "$HTTP_API_ID" || "$HTTP_API_ID" == "None" ]]; then
  HTTP_API_ID="$(aws cloudformation describe-stacks --stack-name rapid-cortex-dev-AppSam2Stack-1URVS591Q6ESS \
    --query "Stacks[0].Outputs[?OutputKey=='HttpApiId'].OutputValue" --output text --region "${AWS_REGION}")"
fi
USER_POOL="$(out UserPoolId)"
CLIENT="$(out UserPoolClientId)"
ISSUER="$(out CognitoIssuer)"
WS_API="$(out WebSocketApiId)"
WS_URL="$(out WebSocketApiUrl)"
# Parent may not export all table names — fall back to convention.
AUDIT="$(out AuditTable 2>/dev/null || true)"
[[ -z "$AUDIT" || "$AUDIT" == "None" ]] && AUDIT="rapid-cortex-audit-${STAGE}"
AGENCIES="$(out AgenciesTable 2>/dev/null || true)"
[[ -z "$AGENCIES" || "$AGENCIES" == "None" ]] && AGENCIES="rapid-cortex-agencies-${STAGE}"
WS_CONN="$(out WebSocketConnectionsTable 2>/dev/null || true)"
[[ -z "$WS_CONN" || "$WS_CONN" == "None" ]] && WS_CONN="rapid-cortex-websocket-connections-${STAGE}"

OPS_TOPIC="$(aws cloudformation describe-stacks --stack-name rapid-cortex-dev-AppSam2Stack-1URVS591Q6ESS \
  --query "Stacks[0].Outputs[?OutputKey=='OpsAlertsTopicArn'].OutputValue" --output text --region "${AWS_REGION}" 2>/dev/null || true)"
[[ "$OPS_TOPIC" == "None" ]] && OPS_TOPIC=""

# JWT authorizer on AppSam2 HttpApi (matches root template hardcoded id for Features).
JWT_AUTH_ID="${FEATURES_HTTP_API_JWT_AUTHORIZER_ID:-3ui9q4}"

echo "HttpApi2Id=${HTTP_API_ID}"
echo "UserPoolId=${USER_POOL}"
echo "Stack=${STACK_NAME}"
echo "SamBuildDir=${SAM_BUILD_DIR}"

echo "── Build API handlers used by Features (ai-gate + features) ──"
if [[ "${SKIP_API_BUILD:-0}" == "1" && -f apps/api/dist/handlers/ai-gate/aiGateHttp.js ]]; then
  echo "SKIP_API_BUILD=1 and aiGateHttp.js present — skipping npm build"
else
  (cd packages/shared && npm run build)
  (cd packages/security && npm run build 2>/dev/null || true)
  (cd apps/api && npm run build)
fi

echo "── sam build features template ──"
# Do NOT pass --base-dir=REPO_ROOT: CodeUri is ../../apps/api relative to
# infra/nested/, and base-dir would resolve that to /Volumes/.../apps/api (wrong).
sam build \
  --template-file infra/nested/stack-app-sam-features.yaml \
  --build-dir "${SAM_BUILD_DIR}/.aws-sam/build" \
  --cached \
  --parallel

echo "── sam deploy ${STACK_NAME} ──"
sam deploy \
  --template-file "${SAM_BUILD_DIR}/.aws-sam/build/template.yaml" \
  --stack-name "${STACK_NAME}" \
  --capabilities CAPABILITY_IAM CAPABILITY_NAMED_IAM CAPABILITY_AUTO_EXPAND \
  --resolve-s3 \
  --no-confirm-changeset \
  --no-fail-on-empty-changeset \
  --region "${AWS_REGION}" \
  --parameter-overrides \
    "DeploymentStage=${STAGE}" \
    "HttpApiId=${HTTP_API_ID}" \
    "HttpApiJwtAuthorizerId=${JWT_AUTH_ID}" \
    "ImportedCognitoUserPoolId=${USER_POOL}" \
    "ImportedCognitoWebClientId=${CLIENT}" \
    "ImportedCognitoIssuer=${ISSUER}" \
    "AuditTable=${AUDIT}" \
    "AgenciesTable=${AGENCIES}" \
    "ManagedPolicyNamePrefix=${APP_NAME}-${STAGE}" \
    "WebUrl=" \
    "OpsAlertsTopicArn=${OPS_TOPIC}" \
    "BedrockModelArn=" \
    "ActiveAgencyIds=${FEATURES_ACTIVE_AGENCY_IDS:-}" \
    "SocialAgencyConfigs=${FEATURES_SOCIAL_AGENCY_CONFIGS:-}" \
    "RingNeighborsWebhookSecretArn=${FEATURES_RING_NEIGHBORS_WEBHOOK_SECRET_ARN:-}" \
    "WebSocketConnectionsTable=${WS_CONN}" \
    "WebSocketApiEndpoint=${WS_URL/wss:/https:}" \
    "WebSocketApiId=${WS_API}" \
    "AgencyKMSKeyArn=${AGENCY_KMS_KEY_ARN:-}" \
    "SIEMEnabled=${SIEM_ENABLED:-false}" \
    "SIEMEndpointUrl=${SIEM_ENDPOINT_URL:-}"

echo "DONE: ${STACK_NAME}"
aws cloudformation describe-stacks --stack-name "${STACK_NAME}" \
  --query "Stacks[0].Outputs[?contains(OutputKey, \`AiGate\`) || contains(OutputKey, \`AgencyAiGate\`)].[OutputKey,OutputValue]" \
  --output table --region "${AWS_REGION}"
aws dynamodb describe-table --table-name "rapid-cortex-agency-ai-gate-${STAGE}" \
  --query 'Table.[TableName,TableStatus]' --output text --region "${AWS_REGION}"
