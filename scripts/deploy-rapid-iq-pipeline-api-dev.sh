#!/usr/bin/env bash
# Surgical Rapid IQ Signal Pipeline API for rapid-cortex-dev (AppSam3 HttpApi).
# Creates pipeline DynamoDB table if missing, deploys stack-app-sam-rapid-iq-pipeline.yaml.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

# shellcheck source=scripts/env-api-dev.sh
source "${ROOT}/scripts/env-api-dev.sh"
export AWS_PROFILE="${AWS_PROFILE:-rapid-cortex}"
export AWS_REGION="${AWS_REGION:-us-east-1}"
export AWS_DEFAULT_REGION="${AWS_DEFAULT_REGION:-$AWS_REGION}"
export NODE_OPTIONS="${NODE_OPTIONS:---max-old-space-size=8192}"

# Prefer /tmp for speed. Makefile hardlinks when SAM_NODE_MODULES_HARDLINK is non-empty
# (even "0"), which fails across Mac Mini → /tmp. Leave unset on /tmp; enable on same volume.
SAM_BUILD_DIR="${RAPID_IQ_PIPELINE_SAM_BUILD_DIR:-/tmp/rc-sam-rapid-iq-pipeline-$(date +%Y%m%d-%H%M%S)}"
mkdir -p "${SAM_BUILD_DIR}"
export SAM_BUILD_DIR
if [[ "${SAM_BUILD_DIR}" == /tmp/* ]] || [[ "${SAM_BUILD_DIR}" == /private/tmp/* ]]; then
  unset SAM_NODE_MODULES_HARDLINK
else
  export SAM_NODE_MODULES_HARDLINK="${SAM_NODE_MODULES_HARDLINK:-1}"
fi
echo "SAM_BUILD_DIR=${SAM_BUILD_DIR}"
echo "SAM_NODE_MODULES_HARDLINK=${SAM_NODE_MODULES_HARDLINK:-<unset>}"

ensure_pipeline_table() {
  local name="$1"
  if aws dynamodb describe-table --table-name "${name}" >/dev/null 2>&1; then
    echo "── Table exists: ${name}"
    return 0
  fi
  echo "── Creating ${name} ──"
  aws dynamodb create-table \
    --table-name "${name}" \
    --billing-mode PAY_PER_REQUEST \
    --attribute-definitions \
      AttributeName=pk,AttributeType=S \
      AttributeName=sk,AttributeType=S \
      AttributeName=gsi1pk,AttributeType=S \
      AttributeName=gsi1sk,AttributeType=S \
      AttributeName=gsi2pk,AttributeType=S \
      AttributeName=gsi2sk,AttributeType=S \
    --key-schema \
      AttributeName=pk,KeyType=HASH \
      AttributeName=sk,KeyType=RANGE \
    --global-secondary-indexes \
      '[{"IndexName":"gsi1-status-score","KeySchema":[{"AttributeName":"gsi1pk","KeyType":"HASH"},{"AttributeName":"gsi1sk","KeyType":"RANGE"}],"Projection":{"ProjectionType":"ALL"}},{"IndexName":"gsi2-source-date","KeySchema":[{"AttributeName":"gsi2pk","KeyType":"HASH"},{"AttributeName":"gsi2sk","KeyType":"RANGE"}],"Projection":{"ProjectionType":"ALL"}}]' \
    --tags Key=Component,Value=rapid-iq-pipeline Key=Stage,Value=dev
  aws dynamodb wait table-exists --table-name "${name}"
  echo "── Ready: ${name}"
}

PIPE_TABLE="${RAPID_IQ_PIPELINE_SIGNALS_TABLE:-rapid-cortex-rapid-iq-pipeline-signals-dev}"
SALES_LEADS_TABLE="${SALES_LEADS_TABLE:-rapid-cortex-sales-leads-dev}"
AUDIT_TABLE="${AUDIT_TABLE:-rapid-cortex-audit-dev}"

ensure_pipeline_table "${PIPE_TABLE}"

# Resolve secret ARNs from existing Rapid IQ stack when unset
if [[ -z "${RAPID_IQ_APOLLO_API_KEY_SECRET_ARN:-}" ]] || [[ -z "${RAPID_IQ_HUNTER_API_KEY_SECRET_ARN:-}" ]] || [[ -z "${ANTHROPIC_API_KEY_SECRET_ARN:-}" ]]; then
  echo "── Resolving secret ARNs from rapid-cortex-dev-AppSamRapidIqStack ──"
  mapfile -t _ARN_ROWS < <(
    aws cloudformation describe-stacks \
      --stack-name rapid-cortex-dev-AppSamRapidIqStack \
      --query 'Stacks[0].Parameters[?ParameterKey==`RapidIqApolloApiKeySecretArn` || ParameterKey==`RapidIqHunterApiKeySecretArn` || ParameterKey==`AnthropicApiKeySecretArn` || ParameterKey==`RapidIqSamGovApiKeySecretArn`].[ParameterKey,ParameterValue]' \
      --output text 2>/dev/null || true
  )
  for row in "${_ARN_ROWS[@]:-}"; do
    key="${row%%$'\t'*}"
    val="${row#*$'\t'}"
    [[ -z "${val}" || "${val}" == "None" ]] && continue
    case "${key}" in
      RapidIqApolloApiKeySecretArn)
        export RAPID_IQ_APOLLO_API_KEY_SECRET_ARN="${RAPID_IQ_APOLLO_API_KEY_SECRET_ARN:-$val}"
        ;;
      RapidIqHunterApiKeySecretArn)
        export RAPID_IQ_HUNTER_API_KEY_SECRET_ARN="${RAPID_IQ_HUNTER_API_KEY_SECRET_ARN:-$val}"
        ;;
      AnthropicApiKeySecretArn)
        export ANTHROPIC_API_KEY_SECRET_ARN="${ANTHROPIC_API_KEY_SECRET_ARN:-$val}"
        ;;
      RapidIqSamGovApiKeySecretArn)
        export RAPID_IQ_SAM_GOV_API_KEY_SECRET_ARN="${RAPID_IQ_SAM_GOV_API_KEY_SECRET_ARN:-$val}"
        ;;
    esac
  done
fi

# Fallbacks matching known provisioned secrets
export RAPID_IQ_APOLLO_API_KEY_SECRET_ARN="${RAPID_IQ_APOLLO_API_KEY_SECRET_ARN:-arn:aws:secretsmanager:us-east-1:158961537080:secret:rapid-cortex/rapid-iq/apollo-api-key-BDql0e}"
export RAPID_IQ_HUNTER_API_KEY_SECRET_ARN="${RAPID_IQ_HUNTER_API_KEY_SECRET_ARN:-arn:aws:secretsmanager:us-east-1:158961537080:secret:rapid-cortex/rapid-iq/hunter-api-key-LXEwMX}"
export ANTHROPIC_API_KEY_SECRET_ARN="${ANTHROPIC_API_KEY_SECRET_ARN:-arn:aws:secretsmanager:us-east-1:158961537080:secret:rapid-cortex/ai/anthropic-fHk4y2}"

if [[ -z "${OPENAI_API_KEY_SECRET_ARN:-}" ]]; then
  OPENAI_API_KEY_SECRET_ARN="$(
    aws secretsmanager describe-secret \
      --secret-id rapid-cortex/ai/openai \
      --query ARN --output text 2>/dev/null || true
  )"
fi
if [[ -z "${OPENAI_API_KEY_SECRET_ARN}" || "${OPENAI_API_KEY_SECRET_ARN}" == "None" ]]; then
  OPENAI_API_KEY_SECRET_ARN=""
fi

echo "Apollo ARN: ${RAPID_IQ_APOLLO_API_KEY_SECRET_ARN}"
echo "Hunter ARN: ${RAPID_IQ_HUNTER_API_KEY_SECRET_ARN}"
echo "Anthropic ARN: ${ANTHROPIC_API_KEY_SECRET_ARN}"
echo "OpenAI ARN: ${OPENAI_API_KEY_SECRET_ARN:-<unset — intel falls back to heuristics>}"

# shellcheck source=scripts/lib/api-vendor-lock.sh
source "${ROOT}/scripts/lib/api-vendor-lock.sh"
# shellcheck source=scripts/lib/prepare-api-vendor-for-sam.sh
source "${ROOT}/scripts/lib/prepare-api-vendor-for-sam.sh"

rc_acquire_api_vendor_lock
REVERT_API_PKG=1
restore_api_pkg() {
  if [[ "${REVERT_API_PKG}" -eq 1 ]]; then
    if [[ -f "${ROOT}/apps/api/package.json.pre-lean" ]]; then
      mv "${ROOT}/apps/api/package.json.pre-lean" "${ROOT}/apps/api/package.json"
    else
      git -C "${ROOT}" checkout HEAD -- apps/api/package.json 2>/dev/null || true
    fi
  fi
  rc_release_api_vendor_lock 2>/dev/null || true
}
trap restore_api_pkg EXIT

RC_API_PKG_BACKUP_SUFFIX=pre-lean rc_prepare_api_vendor_for_sam

echo "── Building shared + API ──"
npm run build -w rapid-cortex-shared
npm run build -w rapid-cortex-security || true
if [[ -d "${ROOT}/apps/api/node_modules/rapid-cortex-shared/dist" ]]; then
  rsync -a --delete "${ROOT}/packages/shared/dist/" "${ROOT}/apps/api/node_modules/rapid-cortex-shared/dist/" || true
fi
if [[ -d "${ROOT}/apps/api/node_modules/rapid-cortex-security/dist" ]]; then
  rsync -a --delete "${ROOT}/packages/security/dist/" "${ROOT}/apps/api/node_modules/rapid-cortex-security/dist/" || true
fi
npm run build -w rapid-cortex-api || true

if [[ ! -f "${ROOT}/apps/api/dist/handlers/rapid-iq/pipeline/signalHttp.js" ]]; then
  echo "ERROR: pipeline signalHttp dist missing after build" >&2
  exit 1
fi
echo "── Using pipeline handler dist ──"

TEMPLATE="${ROOT}/infra/nested/stack-app-sam-rapid-iq-pipeline.yaml"
sam validate --lint --template-file "${TEMPLATE}"

sam build \
  --template-file "${TEMPLATE}" \
  --build-dir "${SAM_BUILD_DIR}" \
  --no-cached \
  --parallel \
  --build-in-source

STACK_NAME="${RAPID_IQ_PIPELINE_STACK_NAME:-rapid-cortex-dev-AppSamRapidIqPipelineStack}"
HTTP_API_ID="${RAPID_IQ_HTTP_API_ID:-tbr4zvjlk5}"

PARAM_OVERRIDES=(
  DeploymentStage=dev
  "HttpApiId=${HTTP_API_ID}"
  "RapidIqPipelineSignalsTable=${PIPE_TABLE}"
  "SalesLeadsTable=${SALES_LEADS_TABLE}"
  "AuditTable=${AUDIT_TABLE}"
  ImportedCognitoUserPoolId=us-east-1_0z6tA6WBs
  ImportedCognitoWebClientId=7moi6sgc2uf4o31omgvo77h3v5
  ManagedPolicyNamePrefix=rapid-cortex-dev
  "AnthropicApiKeySecretArn=${ANTHROPIC_API_KEY_SECRET_ARN}"
  "RapidIqApolloApiKeySecretArn=${RAPID_IQ_APOLLO_API_KEY_SECRET_ARN}"
  "RapidIqHunterApiKeySecretArn=${RAPID_IQ_HUNTER_API_KEY_SECRET_ARN}"
)
if [[ -n "${RAPID_IQ_SAM_GOV_API_KEY_SECRET_ARN:-}" ]]; then
  PARAM_OVERRIDES+=("RapidIqSamGovApiKeySecretArn=${RAPID_IQ_SAM_GOV_API_KEY_SECRET_ARN}")
fi
if [[ -n "${RAPID_IQ_OPENSTATES_API_KEY_SECRET_ARN:-}" ]]; then
  PARAM_OVERRIDES+=("RapidIqOpenstatesApiKeySecretArn=${RAPID_IQ_OPENSTATES_API_KEY_SECRET_ARN}")
fi
if [[ -n "${RAPID_IQ_LEGISCAN_API_KEY_SECRET_ARN:-}" ]]; then
  PARAM_OVERRIDES+=("RapidIqLegiscanApiKeySecretArn=${RAPID_IQ_LEGISCAN_API_KEY_SECRET_ARN}")
fi
if [[ -n "${OPENAI_API_KEY_SECRET_ARN:-}" ]]; then
  PARAM_OVERRIDES+=("OpenAiApiKeySecretArn=${OPENAI_API_KEY_SECRET_ARN}")
fi

sam deploy \
  --template-file "${SAM_BUILD_DIR}/template.yaml" \
  --stack-name "${STACK_NAME}" \
  --capabilities CAPABILITY_IAM CAPABILITY_NAMED_IAM CAPABILITY_AUTO_EXPAND \
  --resolve-s3 \
  --no-confirm-changeset \
  --no-fail-on-empty-changeset \
  --region "${AWS_REGION}" \
  --parameter-overrides "${PARAM_OVERRIDES[@]}"

echo "Rapid IQ Pipeline stack status:"
aws cloudformation describe-stacks --stack-name "${STACK_NAME}" \
  --query 'Stacks[0].StackStatus' --output text

echo "Pipeline + intel routes on ${HTTP_API_ID}:"
aws apigatewayv2 get-routes --api-id "${HTTP_API_ID}" \
  --query 'Items[?contains(RouteKey, `rapid-iq/pipeline`) || contains(RouteKey, `rapid-iq/intel`)].[RouteKey,AuthorizationType]' \
  --output table

echo "DONE: ${STACK_NAME}"
