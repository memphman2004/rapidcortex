#!/usr/bin/env bash
# Recreate ghost dispatcher/supervisor active-calls (+ related call-control) routes
# on AppSam2 HttpApi (t4bdwpjfs5). CFN can report CREATE_COMPLETE while API Gateway
# no longer has the integration/routes.
#
# Usage: AWS_PROFILE=rapid-cortex bash scripts/repair-dispatcher-api-ghost-routes.sh
set -euo pipefail

API_ID="${HTTP_API_2_ID:-t4bdwpjfs5}"
REGION="${AWS_REGION:-us-east-1}"
ACCOUNT_ID="${AWS_ACCOUNT_ID:-158961537080}"
AUTHORIZER_ID="${HTTP_API_2_JWT_AUTHORIZER_ID:-3ui9q4}"
STACK="${REALTIME2_STACK:-rapid-cortex-dev-AppSamRealtime2Stack-KLY0OKM19NUB}"

echo "API:   $API_ID"
echo "Stack: $STACK"

repair_fn_routes() {
  local logical_fn="$1"
  shift
  local keys=("$@")

  local FN
  FN="$(aws cloudformation describe-stack-resource \
    --stack-name "$STACK" \
    --logical-resource-id "$logical_fn" \
    --query 'StackResourceDetail.PhysicalResourceId' --output text)"
  if [[ -z "$FN" || "$FN" == "None" ]]; then
    echo "SKIP  $logical_fn (no physical function)"
    return 0
  fi

  local URI="arn:aws:apigateway:${REGION}:lambda:path/2015-03-31/functions/arn:aws:lambda:${REGION}:${ACCOUNT_ID}:function:${FN}/invocations"

  local INTEG
  INTEG="$(
    aws apigatewayv2 get-integrations --api-id "$API_ID" --output json \
      | FN="$FN" python3 -c '
import json, os, sys
fn = os.environ["FN"]
needle = "function:" + fn
for i in json.load(sys.stdin).get("Items", []):
    uri = i.get("IntegrationUri") or ""
    if needle in uri or uri.endswith("/" + fn + "/invocations"):
        print(i["IntegrationId"])
        break
' || true
  )"

  if [[ -z "${INTEG}" ]]; then
    INTEG="$(aws apigatewayv2 create-integration \
      --api-id "$API_ID" \
      --integration-type AWS_PROXY \
      --integration-uri "$URI" \
      --payload-format-version 2.0 \
      --description "${logical_fn} (repair-dispatcher-api-ghost-routes.sh)" \
      --query IntegrationId --output text)"
    echo "Created integration for $FN: $INTEG"
  else
    echo "Reusing integration for $FN: $INTEG"
  fi

  aws lambda add-permission \
    --function-name "$FN" \
    --statement-id "apigw-realtime2-repair-$(date +%s)-${logical_fn}" \
    --action lambda:InvokeFunction \
    --principal apigateway.amazonaws.com \
    --source-arn "arn:aws:execute-api:${REGION}:${ACCOUNT_ID}:${API_ID}/*" \
    >/dev/null 2>&1 || true

  python3 - "$API_ID" "$INTEG" "$AUTHORIZER_ID" "${keys[@]}" <<'PY'
import json, subprocess, sys

api, integ, authorizer, *keys = sys.argv[1:]
routes = {
    r["RouteKey"]: r
    for r in json.loads(
        subprocess.check_output(
            ["aws", "apigatewayv2", "get-routes", "--api-id", api, "--output", "json"]
        )
    ).get("Items", [])
}

for key in keys:
    existing = routes.get(key)
    target = f"integrations/{integ}"
    # JWT for all except public viewer-style routes (none in this set)
    auth_args = ["--authorization-type", "JWT", "--authorizer-id", authorizer]
    if existing:
        rid = existing["RouteId"]
        if existing.get("Target") == target:
            print(f"OK     {key} -> {integ}")
            continue
        subprocess.check_call(
            [
                "aws", "apigatewayv2", "update-route",
                "--api-id", api,
                "--route-id", rid,
                "--target", target,
                *auth_args,
            ],
            stdout=subprocess.DEVNULL,
        )
        print(f"RETARGET {key} -> {integ}")
    else:
        rid = subprocess.check_output(
            [
                "aws", "apigatewayv2", "create-route",
                "--api-id", api,
                "--route-key", key,
                "--target", target,
                *auth_args,
                "--query", "RouteId",
                "--output", "text",
            ],
            text=True,
        ).strip()
        print(f"CREATE {key} ({rid}) -> {integ}")
PY
}

repair_fn_routes DispatcherListActiveCallsFunction \
  "GET /api/dispatcher/active-calls"

repair_fn_routes SupervisorListActiveCallsFunction \
  "GET /api/supervisor/active-calls"

repair_fn_routes DispatcherAcceptTransferFunction \
  "POST /api/dispatcher/accept-transfer"

repair_fn_routes DispatcherDeclineTransferFunction \
  "POST /api/dispatcher/decline-transfer"

repair_fn_routes SupervisorTransferCallFunction \
  "POST /api/supervisor/transfer-call"

repair_fn_routes SupervisorTakeoverCallFunction \
  "POST /api/supervisor/takeover-call"

repair_fn_routes SupervisorListOperatorsFunction \
  "GET /api/supervisor/operators"

repair_fn_routes SupervisorWatchingFunction \
  "POST /api/supervisor/watching"

echo "── Verify active-calls ──"
aws apigatewayv2 get-routes --api-id "$API_ID" \
  --query "Items[?contains(RouteKey, \`active-calls\`)].[RouteKey,Target]" \
  --output table

echo "DONE"
