#!/usr/bin/env bash
# Recreate ghost escalation routes on AppSam3 HttpApi (tbr4zvjlk5).
#
# Usage: AWS_PROFILE=rapid-cortex bash scripts/repair-escalation-http-routes.sh
set -euo pipefail

API_ID="${HTTP_API_3_ID:-tbr4zvjlk5}"
REGION="${AWS_REGION:-us-east-1}"
ACCOUNT_ID="${AWS_ACCOUNT_ID:-158961537080}"
AUTHORIZER_ID="${HTTP_API_3_JWT_AUTHORIZER_ID:-k8rjdh}"
STACK="${ESCALATION_STACK:-rapid-cortex-dev-AppSamEscalationStack-1G9BQD9OF84RU}"

echo "API:   $API_ID"
echo "Stack: $STACK"

FN="$(aws cloudformation describe-stack-resource \
  --stack-name "$STACK" \
  --logical-resource-id EscalationHttpFunction \
  --query 'StackResourceDetail.PhysicalResourceId' --output text)"

if [[ -z "$FN" || "$FN" == "None" ]]; then
  # Fallback: discover by name prefix
  FN="$(aws lambda list-functions --query "Functions[?contains(FunctionName, \`EscalationHttp\`) && contains(FunctionName, \`dev\`)].FunctionName" --output text | awk '{print $1}')"
fi
echo "Function: $FN"

URI="arn:aws:apigateway:${REGION}:lambda:path/2015-03-31/functions/arn:aws:lambda:${REGION}:${ACCOUNT_ID}:function:${FN}/invocations"

KEYS=(
  "GET /api/escalations"
  "POST /api/escalations"
  "PATCH /api/escalations/{escalationId}"
  "GET /api/escalations/{escalationId}/export"
  "GET /api/escalations/viewer/{token}"
  "GET /api/rc-admin/agencies/{agencyId}/escalation-relationship"
  "PUT /api/rc-admin/agencies/{agencyId}/escalation-relationship"
  "POST /api/venue/push-subscription"
  "DELETE /api/venue/push-subscription"
)

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
    --description "EscalationHttp (repair-escalation-http-routes.sh)" \
    --query IntegrationId --output text)"
  echo "Created integration: $INTEG"
else
  echo "Reusing integration: $INTEG"
fi

aws lambda add-permission \
  --function-name "$FN" \
  --statement-id "apigw-escalation-repair-$(date +%s)" \
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
    # Viewer token route is public (no JWT) — matches SAM template intent for SMS links
    if "viewer/" in key:
        auth_args = ["--authorization-type", "NONE"]
    else:
        auth_args = ["--authorization-type", "JWT", "--authorizer-id", authorizer]
    if existing:
        rid = existing["RouteId"]
        if existing.get("Target") == target:
            print(f"OK     {key} -> {integ}")
            continue
        cmd = [
            "aws", "apigatewayv2", "update-route",
            "--api-id", api,
            "--route-id", rid,
            "--target", target,
            *auth_args,
        ]
        subprocess.check_call(cmd, stdout=subprocess.DEVNULL)
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

echo "── Verify escalations ──"
aws apigatewayv2 get-routes --api-id "$API_ID" \
  --query "Items[?contains(RouteKey, \`escalations\`)].[RouteKey,Target,AuthorizationType]" \
  --output table

echo "DONE"
