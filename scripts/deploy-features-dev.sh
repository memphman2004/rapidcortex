#!/usr/bin/env bash
# Surgical Features stack deploy for live rapid-cortex-dev (AppSam2 HttpApi).
#
# Default path (FEATURES_USE_EXISTING=1): patch template to skip CREATE of Retain
# DynamoDB tables + S3 buckets (deleted nested stack leftovers), then deploy
# Lambdas + ANY /api/features/{proxy+} (+ AiGate routes). Parent keeps
# IncludeAppSamFeaturesNestedStack=false to avoid AlreadyExists.
#
# Fresh environments with no tables: FEATURES_USE_EXISTING=0 uses the full
# stack-app-sam-features.yaml CREATE path.
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
ACCOUNT_ID="$(aws sts get-caller-identity --query Account --output text --region "${AWS_REGION}")"
FEATURES_USE_EXISTING="${FEATURES_USE_EXISTING:-1}"
PY="${FEATURES_PATCH_PYTHON:-${HOME}/.rapid-cortex-checkov-venv/bin/python}"
command -v "$PY" >/dev/null 2>&1 || PY=python3

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
AUDIT="$(out AuditTable 2>/dev/null || true)"
[[ -z "$AUDIT" || "$AUDIT" == "None" ]] && AUDIT="rapid-cortex-audit-${STAGE}"
AGENCIES="$(out AgenciesTable 2>/dev/null || true)"
[[ -z "$AGENCIES" || "$AGENCIES" == "None" ]] && AGENCIES="rapid-cortex-agencies-${STAGE}"
WS_CONN="$(out WebSocketConnectionsTable 2>/dev/null || true)"
[[ -z "$WS_CONN" || "$WS_CONN" == "None" ]] && WS_CONN="rapid-cortex-websocket-connections-${STAGE}"

OPS_TOPIC="$(aws cloudformation describe-stacks --stack-name rapid-cortex-dev-AppSam2Stack-1URVS591Q6ESS \
  --query "Stacks[0].Outputs[?OutputKey=='OpsAlertsTopicArn'].OutputValue" --output text --region "${AWS_REGION}" 2>/dev/null || true)"
[[ "$OPS_TOPIC" == "None" ]] && OPS_TOPIC=""

JWT_AUTH_ID="${FEATURES_HTTP_API_JWT_AUTHORIZER_ID:-3ui9q4}"

echo "HttpApi2Id=${HTTP_API_ID}"
echo "UserPoolId=${USER_POOL}"
echo "Stack=${STACK_NAME}"
echo "SamBuildDir=${SAM_BUILD_DIR}"
echo "FEATURES_USE_EXISTING=${FEATURES_USE_EXISTING}"

echo "── Build API handlers used by Features (ai-gate + features) ──"
if [[ "${SKIP_API_BUILD:-0}" == "1" && -f apps/api/dist/handlers/ai-gate/aiGateHttp.js ]]; then
  echo "SKIP_API_BUILD=1 and aiGateHttp.js present — skipping npm build"
else
  (cd packages/shared && npm run build)
  (cd packages/security && npm run build 2>/dev/null || true)
  (cd apps/api && npm run build)
fi

TEMPLATE_SRC="infra/nested/stack-app-sam-features.yaml"
if [[ "${FEATURES_USE_EXISTING}" == "1" ]]; then
  TEMPLATE_SRC="${SAM_BUILD_DIR}/stack-app-sam-features.existing.json"
  echo "── Patch Features template for Existing tables/buckets ──"
  "$PY" scripts/patch-features-template-existing-resources.py \
    --stage "${STAGE}" \
    --account "${ACCOUNT_ID}" \
    --out "${TEMPLATE_SRC}"
  cp "${TEMPLATE_SRC}" infra/nested/stack-app-sam-features.existing.json
  TEMPLATE_SRC="infra/nested/stack-app-sam-features.existing.json"
fi

echo "── sam build features template ──"
sam build \
  --template-file "${TEMPLATE_SRC}" \
  --build-dir "${SAM_BUILD_DIR}/.aws-sam/build" \
  --cached \
  --parallel

PO=(
  "DeploymentStage=${STAGE}"
  "HttpApiId=${HTTP_API_ID}"
  "HttpApiJwtAuthorizerId=${JWT_AUTH_ID}"
  "ImportedCognitoUserPoolId=${USER_POOL}"
  "ImportedCognitoWebClientId=${CLIENT}"
  "ImportedCognitoIssuer=${ISSUER}"
  "AuditTable=${AUDIT}"
  "AgenciesTable=${AGENCIES}"
  "ManagedPolicyNamePrefix=${APP_NAME}-${STAGE}"
  "WebSocketConnectionsTable=${WS_CONN}"
  "WebSocketApiEndpoint=${WS_URL/wss:/https:}"
  "WebSocketApiId=${WS_API}"
  "SIEMEnabled=${SIEM_ENABLED:-false}"
)
[[ -n "${OPS_TOPIC}" ]] && PO+=("OpsAlertsTopicArn=${OPS_TOPIC}")
[[ -n "${FEATURES_ACTIVE_AGENCY_IDS:-}" ]] && PO+=("ActiveAgencyIds=${FEATURES_ACTIVE_AGENCY_IDS}")
[[ -n "${FEATURES_SOCIAL_AGENCY_CONFIGS:-}" ]] && PO+=("SocialAgencyConfigs=${FEATURES_SOCIAL_AGENCY_CONFIGS}")
[[ -n "${FEATURES_RING_NEIGHBORS_WEBHOOK_SECRET_ARN:-}" ]] && PO+=("RingNeighborsWebhookSecretArn=${FEATURES_RING_NEIGHBORS_WEBHOOK_SECRET_ARN}")
[[ -n "${AGENCY_KMS_KEY_ARN:-}" ]] && PO+=("AgencyKMSKeyArn=${AGENCY_KMS_KEY_ARN}")
[[ -n "${SIEM_ENDPOINT_URL:-}" ]] && PO+=("SIEMEndpointUrl=${SIEM_ENDPOINT_URL}")
[[ -n "${WEB_URL:-}" ]] && PO+=("WebUrl=${WEB_URL}")
[[ -n "${BEDROCK_MODEL_ARN:-}" ]] && PO+=("BedrockModelArn=${BEDROCK_MODEL_ARN}")

if [[ "${FEATURES_USE_EXISTING}" == "1" ]]; then
  PO+=(
    "ExistingCitizensTableName=rapid-cortex-citizens-${STAGE}"
    "ExistingAddressIntelTableName=rapid-cortex-address-intel-${STAGE}"
    "ExistingAltResponseTableName=rapid-cortex-alt-response-${STAGE}"
    "ExistingCoRespondersTableName=rapid-cortex-co-responders-${STAGE}"
    "ExistingMutualAidTableName=rapid-cortex-mutual-aid-${STAGE}"
    "ExistingMCITableName=rapid-cortex-mci-${STAGE}"
    "ExistingInfraTableName=rapid-cortex-infrastructure-${STAGE}"
    "ExistingInterpreterTableName=rapid-cortex-interpreter-${STAGE}"
    "ExistingEvidenceTableName=rapid-cortex-evidence-${STAGE}"
    "ExistingAssessmentTableName=rapid-cortex-assessment-${STAGE}"
    "ExistingLearningTableName=rapid-cortex-learning-${STAGE}"
    "ExistingPublicEventsTableName=rapid-cortex-public-events-${STAGE}"
    "ExistingCheckinTableName=rapid-cortex-checkin-${STAGE}"
    "ExistingSocialSignalsTableName=rapid-cortex-social-signals-${STAGE}"
    "ExistingAgencyAiGateTableName=rapid-cortex-agency-ai-gate-${STAGE}"
    "ExistingPrePlanBucketName=rapid-cortex-preplans-${STAGE}-${ACCOUNT_ID}"
    "ExistingEvidenceBucketName=rapid-cortex-evidence-${STAGE}-${ACCOUNT_ID}"
  )
fi

echo "── sam deploy ${STACK_NAME} ──"
sam deploy \
  --template-file "${SAM_BUILD_DIR}/.aws-sam/build/template.yaml" \
  --stack-name "${STACK_NAME}" \
  --capabilities CAPABILITY_IAM CAPABILITY_NAMED_IAM CAPABILITY_AUTO_EXPAND \
  --resolve-s3 \
  --no-confirm-changeset \
  --no-fail-on-empty-changeset \
  --region "${AWS_REGION}" \
  --parameter-overrides "${PO[@]}"

echo "DONE: ${STACK_NAME}"
aws apigatewayv2 get-routes --api-id "${HTTP_API_ID}" \
  --query "Items[?contains(RouteKey, 'features')].[RouteKey]" --output text --region "${AWS_REGION}"
aws dynamodb describe-table --table-name "rapid-cortex-agency-ai-gate-${STAGE}" \
  --query 'Table.[TableName,TableStatus]' --output text --region "${AWS_REGION}"
