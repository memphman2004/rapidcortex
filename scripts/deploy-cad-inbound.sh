#!/usr/bin/env bash
# Deploy / refresh CAD inbound EventBridge bus + CadSessionOpen sidecar stacks.
# These stay outside the parent nested tree to avoid AlreadyExists on nexcortiq.cad.
# Called from scripts/deploy.sh after a successful sam deploy (or standalone).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
STAGE="${1:-${STAGE:-dev}}"
AWS_PROFILE="${AWS_PROFILE:-rapid-cortex}"
AWS_DEFAULT_REGION="${AWS_DEFAULT_REGION:-us-east-1}"
export AWS_PROFILE AWS_DEFAULT_REGION

CAD_SOURCE_ACCOUNT_ID="${CAD_SOURCE_ACCOUNT_ID:-621957412915}"
CAD_EVENT_BUS_NAME="${CAD_EVENT_BUS_NAME:-nexcortiq.cad}"
PARENT_STACK="${PARENT_STACK:-rapid-cortex-${STAGE}}"
PREARRIVAL_STACK="${PREARRIVAL_STACK:-${PARENT_STACK}-AppSamPreArrivalStack}"
BUS_STACK="${BUS_STACK:-rapid-cortex-cad-event-bus-${STAGE}}"
SESSION_STACK="${SESSION_STACK:-rapid-cortex-cad-session-open-${STAGE}}"
SKIP_CAD_SESSION_OPEN="${SKIP_CAD_SESSION_OPEN:-0}"

echo "==> CAD inbound bus (${BUS_STACK})"
aws cloudformation deploy \
  --stack-name "${BUS_STACK}" \
  --template-file "${ROOT}/infra/nested/stack-cad-event-bus.yaml" \
  --parameter-overrides "CadSourceAccountId=${CAD_SOURCE_ACCOUNT_ID}" \
  --tags "App=NexCortiQ" "Purpose=cad-inbound" "Stage=${STAGE}" \
  --no-fail-on-empty-changeset

aws events describe-event-bus --name "${CAD_EVENT_BUS_NAME}" --query '{Name:Name,Arn:Arn}' --output table

if [[ "${SKIP_CAD_SESSION_OPEN}" == "1" ]]; then
  echo "SKIP_CAD_SESSION_OPEN=1 — bus only"
  exit 0
fi

if ! aws cloudformation describe-stacks --stack-name "${PREARRIVAL_STACK}" --query 'Stacks[0].StackStatus' --output text >/dev/null 2>&1; then
  echo "WARN: ${PREARRIVAL_STACK} missing — skipping CadSessionOpen sidecar" >&2
  exit 0
fi

phys() {
  local logical="$1"
  aws cloudformation describe-stack-resource \
    --stack-name "${PREARRIVAL_STACK}" \
    --logical-resource-id "${logical}" \
    --query 'StackResourceDetail.PhysicalResourceId' \
    --output text 2>/dev/null || true
}

LAYER="$(phys NodeDepsLayera12f5bf31e)"
# Layer logical id can drift across builds — fall back to any *NodeDeps* layer
if [[ -z "${LAYER}" || "${LAYER}" == "None" ]]; then
  LAYER="$(aws cloudformation list-stack-resources --stack-name "${PREARRIVAL_STACK}" \
    --query "StackResourceSummaries[?ResourceType=='AWS::Lambda::LayerVersion' && contains(LogicalResourceId, 'NodeDeps')].PhysicalResourceId | [0]" \
    --output text)"
fi
PROTO_NAME="$(phys ProtocolReconciliationFunction)"
ETA_NAME="$(phys EtaNotificationFunction)"
ROLE_NAME="$(phys ProtocolReconciliationFunctionRole)"
ACCOUNT_ID="$(aws sts get-caller-identity --query Account --output text)"
ROLE_ARN="arn:aws:iam::${ACCOUNT_ID}:role/${ROLE_NAME}"

# EventBridge targets require Lambda ARNs (not bare function names).
lambda_arn() {
  local name="$1"
  if [[ "$name" == arn:aws:lambda:* ]]; then
    echo "$name"
    return
  fi
  aws lambda get-function --function-name "$name" --query 'Configuration.FunctionArn' --output text
}
PROTO="$(lambda_arn "${PROTO_NAME}")"
ETA="$(lambda_arn "${ETA_NAME}")"

if [[ -z "${LAYER}" || "${LAYER}" == "None" || -z "${PROTO}" || "${PROTO}" == "None" || -z "${ETA}" || "${ETA}" == "None" || -z "${ROLE_NAME}" || "${ROLE_NAME}" == "None" ]]; then
  echo "ERROR: could not resolve PreArrival resources for CadSessionOpen (layer/proto/eta/role)" >&2
  exit 1
fi

# Reuse current CadSessionOpen code object if present; otherwise keep existing stack CodeS3*
CURRENT_FN="$(aws cloudformation describe-stacks --stack-name "${SESSION_STACK}" \
  --query "Stacks[0].Outputs[?OutputKey=='CadSessionOpenFunctionName'].OutputValue | [0]" \
  --output text 2>/dev/null || echo None)"
CODE_BUCKET=""
CODE_KEY=""
if [[ -n "${CURRENT_FN}" && "${CURRENT_FN}" != "None" ]]; then
  CODE_LOC="$(aws lambda get-function --function-name "${CURRENT_FN}" --query 'Code.Location' --output text 2>/dev/null || true)"
  # Prefer previous stack parameters when available
  CODE_BUCKET="$(aws cloudformation describe-stacks --stack-name "${SESSION_STACK}" \
    --query "Stacks[0].Parameters[?ParameterKey=='CodeS3Bucket'].ParameterValue | [0]" --output text 2>/dev/null || true)"
  CODE_KEY="$(aws cloudformation describe-stacks --stack-name "${SESSION_STACK}" \
    --query "Stacks[0].Parameters[?ParameterKey=='CodeS3Key'].ParameterValue | [0]" --output text 2>/dev/null || true)"
  unset CODE_LOC
fi

if [[ -z "${CODE_BUCKET}" || "${CODE_BUCKET}" == "None" || -z "${CODE_KEY}" || "${CODE_KEY}" == "None" ]]; then
  echo "WARN: CadSessionOpen code S3 params unknown — skipping session-open update (bus already deployed)." >&2
  echo "  Seed once with CodeS3Bucket/CodeS3Key, or set SKIP_CAD_SESSION_OPEN=0 after uploading dist zip." >&2
  exit 0
fi

echo "==> CadSessionOpen sidecar (${SESSION_STACK})"
aws cloudformation deploy \
  --stack-name "${SESSION_STACK}" \
  --template-file "${ROOT}/infra/nested/stack-cad-session-open.yaml" \
  --capabilities CAPABILITY_IAM \
  --parameter-overrides \
    "DeploymentStage=${STAGE}" \
    "CadEventBusName=${CAD_EVENT_BUS_NAME}" \
    "ExistingNodeDepsLayerArn=${LAYER}" \
    "ExistingProtocolFunctionArn=${PROTO}" \
    "ExistingEtaFunctionArn=${ETA}" \
    "LambdaExecutionRoleArn=${ROLE_ARN}" \
    "LambdaExecutionRoleName=${ROLE_NAME}" \
    "CodeS3Bucket=${CODE_BUCKET}" \
    "CodeS3Key=${CODE_KEY}" \
    "ManagedPolicyNamePrefix=rapid-cortex-${STAGE}" \
  --tags "App=NexCortiQ" "Purpose=cad-session-open" "Stage=${STAGE}" \
  --no-fail-on-empty-changeset

echo "==> nexcortiq.cad rules"
aws events list-rules --event-bus-name "${CAD_EVENT_BUS_NAME}" --query 'Rules[].{Name:Name,State:State}' --output table

# Optional write-back ops alarms (#66) — set DEPLOY_CAD_WRITEBACK_ALARMS=1
if [[ "${DEPLOY_CAD_WRITEBACK_ALARMS:-0}" == "1" ]]; then
  WB_FN="$(aws lambda list-functions --output json | python3 -c "import json,sys; print(next((f['FunctionName'] for f in json.load(sys.stdin)['Functions'] if 'CadWritebackHttp' in f['FunctionName']), ''))")"
  CONN_FN="$(aws lambda list-functions --output json | python3 -c "import json,sys; print(next((f['FunctionName'] for f in json.load(sys.stdin)['Functions'] if 'CadConnectorHttp' in f['FunctionName']), ''))")"
  POLL_FN="$(aws lambda list-functions --output json | python3 -c "import json,sys; print(next((f['FunctionName'] for f in json.load(sys.stdin)['Functions'] if 'CadIngestionPolling' in f['FunctionName']), ''))")"
  OPS_ARN="${OPS_ALERTS_TOPIC_ARN:-}"
  if [[ -z "${OPS_ARN}" ]]; then
    OPS_ARN="$(aws sns list-topics --output json | python3 -c "import json,sys; print(next((t['TopicArn'] for t in json.load(sys.stdin)['Topics'] if 'OpsAlerts' in t['TopicArn'] and '${STAGE}' in t['TopicArn']), ''))")"
  fi
  if [[ -n "${WB_FN}" && -n "${OPS_ARN}" ]]; then
    echo "==> CAD write-back alarms"
    aws cloudformation deploy \
      --stack-name "rapid-cortex-cad-writeback-alarms-${STAGE}" \
      --template-file "${ROOT}/infra/nested/stack-cad-writeback-alarms.yaml" \
      --parameter-overrides \
        "DeploymentStage=${STAGE}" \
        "OpsAlertsTopicArn=${OPS_ARN}" \
        "CadWritebackHttpFunctionName=${WB_FN}" \
        "CadConnectorHttpFunctionName=${CONN_FN}" \
        "CadIngestionPollingFunctionName=${POLL_FN}" \
        "AlarmNamePrefix=rapid-cortex" \
      --tags "App=NexCortiQ" "Purpose=cad-writeback-alarms" "Stage=${STAGE}" \
      --no-fail-on-empty-changeset
  else
    echo "WARN: DEPLOY_CAD_WRITEBACK_ALARMS=1 but CadWritebackHttp or OpsAlerts topic not found" >&2
  fi
fi
