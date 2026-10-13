#!/usr/bin/env bash
# Point NexiQ workspace routes (opportunities / refresh / research helpers) at
# RapidIqHttpFunction. Pipeline SignalHttp (w5si50q) has drifted onto these
# RouteKeys before and returns 404 for GET /api/rapid-iq/opportunities.
#
# Usage: AWS_PROFILE=rapid-cortex bash scripts/repair-rapid-iq-http-routes.sh
set -euo pipefail

API_ID="${HTTP_API_3_ID:-tbr4zvjlk5}"
REGION="${AWS_REGION:-us-east-1}"
ACCOUNT_ID="${AWS_ACCOUNT_ID:-158961537080}"
FN="${RAPID_IQ_HTTP_FUNCTION_NAME:-$(
  aws lambda list-functions --region "$REGION" --output json \
    | python3 -c "import json,sys; print(next(f['FunctionName'] for f in json.load(sys.stdin)['Functions'] if 'RapidIqHttpFunction' in f['FunctionName'] and 'RapidIqP' not in f['FunctionName']))"
)}"

URI="arn:aws:apigateway:${REGION}:lambda:path/2015-03-31/functions/arn:aws:lambda:${REGION}:${ACCOUNT_ID}:function:${FN}/invocations"

KEYS=(
  "GET /api/rapid-iq/opportunities"
  "GET /api/rapid-iq/opportunities/{opportunityId}"
  "PATCH /api/rapid-iq/opportunities/{opportunityId}"
  "GET /api/rapid-iq/opportunities/{opportunityId}/signals"
  "GET /api/rapid-iq/opportunities/{opportunityId}/contacts"
  "GET /api/rapid-iq/opportunities/{opportunityId}/sources"
  "POST /api/rapid-iq/refresh"
  "GET /api/rapid-iq/refresh/status"
  "POST /api/rapid-iq/talking-points"
  "POST /api/rapid-iq/rfp-outline"
  "POST /api/rapid-iq/agency-profile"
  "POST /api/rapid-iq/competitor-intel"
  "POST /api/rapid-iq/convert-to-lead"
  "POST /api/rapid-iq/search-contacts"
  "POST /api/rapid-iq/outreach"
  "POST /api/rapid-iq/research-agency"
  "POST /api/rapid-iq/signal-chat"
)

echo "Function: $FN"
echo "API:      $API_ID"

# Reuse an existing RapidIqHttp integration if present; otherwise create one.
INTEG="$(
  aws apigatewayv2 get-integrations --api-id "$API_ID" --output json \
    | python3 -c "
import json,sys
uri=sys.argv[1]
for i in json.load(sys.stdin).get('Items',[]):
    if (i.get('IntegrationUri') or '').endswith(uri.split('functions/')[-1]) or uri in (i.get('IntegrationUri') or ''):
        print(i['IntegrationId']); break
" "$URI" || true
)"

if [[ -z "${INTEG}" ]]; then
  INTEG="$(aws apigatewayv2 create-integration \
    --api-id "$API_ID" \
    --integration-type AWS_PROXY \
    --integration-uri "$URI" \
    --payload-format-version 2.0 \
    --description "RapidIqHttp (repair-rapid-iq-http-routes.sh)" \
    --query IntegrationId --output text)"
  echo "Created integration: $INTEG"
  aws lambda add-permission \
    --function-name "$FN" \
    --statement-id "apigw-rapid-iq-http-repair-$(date +%s)" \
    --action lambda:InvokeFunction \
    --principal apigateway.amazonaws.com \
    --source-arn "arn:aws:execute-api:${REGION}:${ACCOUNT_ID}:${API_ID}/*" \
    >/dev/null
else
  echo "Reusing integration: $INTEG"
fi

python3 - "$API_ID" "$INTEG" "${KEYS[@]}" <<'PY'
import json, subprocess, sys
api, integ, *keys = sys.argv[1:]
routes = {
    r["RouteKey"]: r
    for r in json.loads(
        subprocess.check_output(
            ["aws", "apigatewayv2", "get-routes", "--api-id", api, "--output", "json"],
            text=True,
        )
    )["Items"]
}
for key in keys:
    r = routes.get(key)
    if not r:
        print("MISSING", key)
        continue
    target = f"integrations/{integ}"
    if r.get("Target") == target:
        print("OK (already)", key)
        continue
    subprocess.check_call(
        [
            "aws",
            "apigatewayv2",
            "update-route",
            "--api-id",
            api,
            "--route-id",
            r["RouteId"],
            "--target",
            target,
        ]
    )
    print("UPDATED", key, "->", target)
PY

echo "Done. Hard-refresh /rc-admin/rapid-iq (opportunities should stop 404'ing)."
