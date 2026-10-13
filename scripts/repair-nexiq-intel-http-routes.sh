#!/usr/bin/env bash
# Recreate ghost NexiQ Intel routes on AppSam3 HttpApi (tbr4zvjlk5).
# CFN stack rapid-cortex-nexiq-intel-app-dev can report CREATE_COMPLETE while
# API Gateway no longer has the integration/routes (404 on Intel Coverage).
#
# Usage: AWS_PROFILE=rapid-cortex bash scripts/repair-nexiq-intel-http-routes.sh
set -euo pipefail

API_ID="${HTTP_API_3_ID:-tbr4zvjlk5}"
REGION="${AWS_REGION:-us-east-1}"
ACCOUNT_ID="${AWS_ACCOUNT_ID:-158961537080}"
FN="${NEXIQ_INTEL_API_FUNCTION_NAME:-rapid-cortex-nexiq-intel-api-dev}"
AUTHORIZER_ID="${HTTP_API_3_JWT_AUTHORIZER_ID:-k8rjdh}"

URI="arn:aws:apigateway:${REGION}:lambda:path/2015-03-31/functions/arn:aws:lambda:${REGION}:${ACCOUNT_ID}:function:${FN}/invocations"

KEYS=(
  "GET /api/rc-admin/nexiq/intel/sources"
  "POST /api/rc-admin/nexiq/intel/sources"
  "GET /api/rc-admin/nexiq/intel/sources/{sourceId}"
  "PATCH /api/rc-admin/nexiq/intel/sources/{sourceId}"
  "DELETE /api/rc-admin/nexiq/intel/sources/{sourceId}"
  "POST /api/rc-admin/nexiq/intel/sources/{sourceId}/run"
  "GET /api/rc-admin/nexiq/intel/sources/{sourceId}/runs"
  "GET /api/rc-admin/nexiq/intel/sources/{sourceId}/documents"
  "GET /api/rc-admin/nexiq/intel/documents/{docId}"
  "GET /api/rc-admin/nexiq/intel/coverage"
  "GET /api/rc-admin/nexiq/intel/coverage/history"
  "GET /api/rc-admin/nexiq/intel/gaps"
  "POST /api/rc-admin/nexiq/intel/gaps"
  "GET /api/rc-admin/nexiq/intel/benchmarks"
  "POST /api/rc-admin/nexiq/intel/benchmarks"
)

echo "Function: $FN"
echo "API:      $API_ID"

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
    --description "NexiQIntelApi (repair-nexiq-intel-http-routes.sh)" \
    --query IntegrationId --output text)"
  echo "Created integration: $INTEG"
else
  echo "Reusing integration: $INTEG"
fi

aws lambda add-permission \
  --function-name "$FN" \
  --statement-id "apigw-nexiq-intel-repair-$(date +%s)" \
  --action lambda:InvokeFunction \
  --principal apigateway.amazonaws.com \
  --source-arn "arn:aws:execute-api:${REGION}:${ACCOUNT_ID}:${API_ID}/*" \
  >/dev/null 2>&1 || true

python3 - "$API_ID" "$INTEG" "$AUTHORIZER_ID" "${KEYS[@]}" <<'PY'
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
                "--authorization-type", "JWT",
                "--authorizer-id", authorizer,
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
                "--authorization-type", "JWT",
                "--authorizer-id", authorizer,
                "--query", "RouteId",
                "--output", "text",
            ],
            text=True,
        ).strip()
        print(f"CREATE {key} ({rid}) -> {integ}")
PY

echo "── Verify coverage route ──"
aws apigatewayv2 get-routes --api-id "$API_ID" \
  --query "Items[?contains(RouteKey, \`nexiq/intel/coverage\`)].[RouteKey,Target]" \
  --output table

echo "DONE"
