#!/usr/bin/env bash
# recover-rapidiq-pipeline-rollback.sh
#
# Unstick AppSamRapidIqPipeline nested stack from UPDATE_ROLLBACK_FAILED when
# ResourcesToSkip cannot clear a ghost AWS::ApiGatewayV2::Integration (CFN still
# calls Update/Get on the missing IntegrationId — seen with s3r1f5g on tbr4zvjlk5).
#
# IMPORTANT: CFN stack rapid-cortex-dev / DeploymentStage=dev IS production
# (account 158961537080).
#
# What this script does:
#   1) Deletes the stuck nested stack (only safe path when skip-rollback fails)
#   2) Ensures SignalHttp Lambda invoke permission + AWS_PROXY integration exist
#   3) Recreates rapid-iq / watch RouteKeys on AppSam3 HttpApi (tbr4zvjlk5)
#
# Afterward:
#   - Surgical stack rapid-cortex-dev-AppSamRapidIqPipelineStack keeps Lambdas
#   - Parent still references deleted nested ARN until a root update renames
#     AppSamRapidIqPipelineStack → AppSamNexiQPipelineStack with Retain on the old id
#   - Template uses SignalHttpIntegrationV3 so the next sam deploy CREATEs cleanly
#
# Usage:
#   AWS_PROFILE=rapid-cortex bash scripts/recover-rapidiq-pipeline-rollback.sh
#   AWS_PROFILE=rapid-cortex bash scripts/recover-rapidiq-pipeline-rollback.sh --routes-only
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REGION="${AWS_REGION:-us-east-1}"
export AWS_PROFILE="${AWS_PROFILE:-rapid-cortex}"
export AWS_REGION="${REGION}"
export AWS_DEFAULT_REGION="${REGION}"

HTTP_API_ID="${RAPID_IQ_HTTP_API_ID:-tbr4zvjlk5}"
NESTED_STACK="${RAPID_IQ_NESTED_PIPELINE_STACK:-rapid-cortex-dev-AppSamRapidIqPipelineStack-JWN4SGUYZXYF}"
SURGICAL_STACK="${RAPID_IQ_PIPELINE_STACK_NAME:-rapid-cortex-dev-AppSamRapidIqPipelineStack}"
SIGNAL_FN="${RAPID_IQ_SIGNAL_HTTP_FUNCTION:-}"
INTEGRATION_ID="${RAPID_IQ_SIGNAL_INTEGRATION_ID:-}"
ROUTES_ONLY=0

for arg in "$@"; do
  case "${arg}" in
  --routes-only) ROUTES_ONLY=1 ;;
  --help | -h)
    sed -n '2,28p' "$0"
    exit 0
    ;;
  *)
    echo "Unknown argument: ${arg}" >&2
    exit 1
    ;;
  esac
done

resolve_signal_fn() {
  if [[ -n "${SIGNAL_FN}" ]]; then
    echo "${SIGNAL_FN}"
    return
  fi
  aws cloudformation describe-stack-resource \
    --stack-name "${SURGICAL_STACK}" \
    --logical-resource-id SignalHttpFunction \
    --query 'StackResourceDetail.PhysicalResourceId' \
    --output text
}

ensure_integration() {
  local fn_arn uri existing id
  fn_arn="$(aws lambda get-function --function-name "${SIGNAL_FN}" --query 'Configuration.FunctionArn' --output text)"
  uri="arn:aws:apigateway:${REGION}:lambda:path/2015-03-31/functions/${fn_arn}/invocations"

  if [[ -n "${INTEGRATION_ID}" ]]; then
    if aws apigatewayv2 get-integration --api-id "${HTTP_API_ID}" --integration-id "${INTEGRATION_ID}" >/dev/null 2>&1; then
      aws apigatewayv2 update-integration \
        --api-id "${HTTP_API_ID}" \
        --integration-id "${INTEGRATION_ID}" \
        --integration-uri "${uri}" >/dev/null
      echo "${INTEGRATION_ID}"
      return
    fi
  fi

  existing="$(
    aws apigatewayv2 get-integrations --api-id "${HTTP_API_ID}" \
      --query "Items[?contains(IntegrationUri||'', '${SIGNAL_FN}')].IntegrationId | [0]" \
      --output text 2>/dev/null || true
  )"
  if [[ -n "${existing}" && "${existing}" != "None" ]]; then
    echo "${existing}"
    return
  fi

  aws apigatewayv2 create-integration \
    --api-id "${HTTP_API_ID}" \
    --integration-type AWS_PROXY \
    --integration-uri "${uri}" \
    --payload-format-version "2.0" \
    --description "NexiQ SignalHttp (recover-rapidiq-pipeline-rollback)" \
    --query 'IntegrationId' --output text
}

ensure_invoke_permission() {
  local sid="apigw-${HTTP_API_ID}-signalhttp-recover"
  aws lambda add-permission \
    --function-name "${SIGNAL_FN}" \
    --statement-id "${sid}" \
    --action lambda:InvokeFunction \
    --principal apigateway.amazonaws.com \
    --source-arn "arn:aws:execute-api:${REGION}:158961537080:${HTTP_API_ID}/*" \
    2>/dev/null || true
}

recreate_routes() {
  local auth_id target
  auth_id="$(aws apigatewayv2 get-authorizers --api-id "${HTTP_API_ID}" --query 'Items[0].AuthorizerId' --output text)"
  [[ "${auth_id}" == "None" || "${auth_id}" == "null" ]] && auth_id=""
  target="integrations/${INTEGRATION_ID}"

  python3 - "${HTTP_API_ID}" "${target}" "${auth_id}" <<'PY'
import json, subprocess, sys

api, target, auth_id = sys.argv[1], sys.argv[2], sys.argv[3]
routes = [
  ("GET /api/rapid-iq/pipeline/signals", "JWT"),
  ("POST /api/rapid-iq/pipeline/signals", "JWT"),
  ("POST /api/watch/ingest", "NONE"),
  ("GET /api/watch/health", "NONE"),
  ("GET /api/watch/stats", "JWT"),
  ("GET /api/watch/signals", "JWT"),
  ("GET /api/watch/signals/{id}", "JWT"),
  ("PATCH /api/watch/signals/{id}", "JWT"),
  ("POST /api/watch/signals/{id}/qualify", "JWT"),
  ("POST /api/watch/signals/{id}/dismiss", "JWT"),
  ("POST /api/watch/signals/{id}/monitor", "JWT"),
  ("POST /api/watch/signals/{id}/assign", "JWT"),
  ("POST /api/rapid-iq/pipeline/watch-ingest", "NONE"),
  ("GET /api/rapid-iq/pipeline/signals/{signalId}", "JWT"),
  ("PATCH /api/rapid-iq/pipeline/signals/{signalId}", "JWT"),
  ("POST /api/rapid-iq/pipeline/signals/{signalId}/push-to-crm", "JWT"),
  ("GET /api/rapid-iq/pipeline/credits", "JWT"),
  ("POST /api/rapid-iq/pipeline/research", "JWT"),
  ("GET /api/rapid-iq/pipeline/agencies", "JWT"),
  ("GET /api/rapid-iq/pipeline/agencies/{agencyId}", "JWT"),
  ("GET /api/rapid-iq/intel/opportunities", "JWT"),
  ("POST /api/rapid-iq/intel/opportunities", "JWT"),
  ("GET /api/rapid-iq/intel/opportunities/{intelId}", "JWT"),
  ("PATCH /api/rapid-iq/intel/opportunities/{intelId}", "JWT"),
  ("POST /api/rapid-iq/intel/opportunities/{intelId}/analyze", "JWT"),
  ("POST /api/rapid-iq/intel/opportunities/{intelId}/pursuit-brief", "JWT"),
  ("POST /api/rapid-iq/intel/opportunities/{intelId}/outreach", "JWT"),
  ("POST /api/rapid-iq/intel/opportunities/{intelId}/bid-no-bid", "JWT"),
  ("GET /api/rapid-iq/intel/watches", "JWT"),
  ("POST /api/rapid-iq/intel/watches", "JWT"),
  ("GET /api/rapid-iq/intel/watches/{watchId}", "JWT"),
  ("PATCH /api/rapid-iq/intel/watches/{watchId}", "JWT"),
  ("POST /api/rapid-iq/intel/watches/{watchId}/run", "JWT"),
  ("GET /api/rapid-iq/intel/rfp-counts", "JWT"),
  ("GET /api/rapid-iq/sales-automation/sequences", "JWT"),
  ("POST /api/rapid-iq/sales-automation/sequences", "JWT"),
  ("GET /api/rapid-iq/sales-automation/sequences/{sequenceId}", "JWT"),
  ("POST /api/rapid-iq/sales-automation/sequences/{sequenceId}/approve", "JWT"),
  ("POST /api/rapid-iq/sales-automation/sequences/{sequenceId}/suppress", "JWT"),
  ("GET /api/rapid-iq/sales-automation/drafts", "JWT"),
  ("POST /api/rapid-iq/sales-automation/drafts/{draftId}/approve", "JWT"),
  ("GET /api/rapid-iq/sales-automation/campaigns", "JWT"),
  ("GET /api/rapid-iq/sales-automation/metrics", "JWT"),
  ("ANY /api/rapid-iq/sales-automation/{proxy+}", "JWT"),
]

def run(args):
  return subprocess.check_output(args, text=True, stderr=subprocess.STDOUT)

existing = {
  i["RouteKey"]: i["RouteId"]
  for i in json.loads(run(["aws", "apigatewayv2", "get-routes", "--api-id", api, "--output", "json"])).get("Items", [])
}

for rk, auth in routes:
  want = "NONE" if auth == "NONE" or not auth_id else "JWT"
  if rk in existing:
    args = ["aws", "apigatewayv2", "update-route", "--api-id", api, "--route-id", existing[rk], "--target", target]
    run(args)
    print(f"UPD {rk} -> {existing[rk]}")
    continue
  args = [
    "aws", "apigatewayv2", "create-route",
    "--api-id", api, "--route-key", rk, "--target", target,
    "--authorization-type", want,
  ]
  if want == "JWT":
    args += ["--authorizer-id", auth_id]
  out = json.loads(run(args))
  print(f"OK  {rk} -> {out.get('RouteId')}")
PY
}

echo "=== HttpApi ${HTTP_API_ID} / surgical ${SURGICAL_STACK} ==="
SIGNAL_FN="$(resolve_signal_fn)"
echo "SignalHttpFunction: ${SIGNAL_FN}"

if [[ "${ROUTES_ONLY}" -eq 0 ]]; then
  st="$(aws cloudformation describe-stacks --stack-name "${NESTED_STACK}" --query 'Stacks[0].StackStatus' --output text 2>/dev/null || echo DELETED)"
  echo "Nested ${NESTED_STACK}: ${st}"
  if [[ "${st}" == "UPDATE_ROLLBACK_FAILED" ]]; then
    echo "=== Deleting stuck nested stack (skip-rollback cannot clear ApiGatewayV2 ghost) ==="
    aws cloudformation delete-stack --stack-name "${NESTED_STACK}"
    aws cloudformation wait stack-delete-complete --stack-name "${NESTED_STACK}" \
      || echo "WARN: wait returned non-zero — check stack status"
  elif [[ "${st}" != "DELETED" ]]; then
    echo "WARN: nested stack status is ${st}; not deleting. Use --routes-only or delete manually."
  fi
fi

echo "=== Ensure integration + invoke permission ==="
INTEGRATION_ID="$(ensure_integration)"
echo "IntegrationId: ${INTEGRATION_ID}"
ensure_invoke_permission

echo "=== Recreate routes ==="
recreate_routes

echo "=== Smoke (expect 401 without JWT on protected routes) ==="
curl -sS -o /dev/null -w "GET /api/rapid-iq/pipeline/signals -> HTTP %{http_code}\n" \
  "https://${HTTP_API_ID}.execute-api.${REGION}.amazonaws.com/api/rapid-iq/pipeline/signals" || true

echo ""
echo "DONE. Parent may still reference deleted nested ARN:"
echo "  aws cloudformation describe-stack-resource --stack-name rapid-cortex-dev \\"
echo "    --logical-resource-id AppSamRapidIqPipelineStack"
echo "Before next root deploy: Retain + rename to AppSamNexiQPipelineStack (see infra/template.yaml)."
echo "Surgical redeploy: RAPID_IQ_PIPELINE_STACK_NAME=${SURGICAL_STACK} bash scripts/deploy-rapid-iq-pipeline-api-dev.sh"