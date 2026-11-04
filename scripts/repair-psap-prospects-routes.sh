#!/usr/bin/env bash
# Recreate /api/rc-admin/psap-prospects* routes on AppSam3 HttpApi when CFN drift
# has removed them (BFF/list returns API GW 404 while the Lambda + Dynamo still exist).
set -euo pipefail

REGION="${AWS_REGION:-us-east-1}"
API_ID="${PSAP_HTTP_API_ID:-tbr4zvjlk5}"
AUTHZ_ID="${PSAP_HTTP_API_JWT_AUTHORIZER_ID:-k8rjdh}"
FN_NAME="${PSAP_PROSPECTS_FUNCTION_NAME:-}"
NESTED_STACK="${PSAP_CRM_STACK_NAME:-rapid-cortex-dev-AppSamPsapCrmStack}"

if [[ -z "$FN_NAME" ]]; then
  FN_NAME="$(
    aws cloudformation describe-stack-resource \
      --stack-name "$NESTED_STACK" \
      --logical-resource-id PsapProspectsHttpFunction \
      --region "$REGION" \
      --query 'StackResourceDetail.PhysicalResourceId' \
      --output text 2>/dev/null || true
  )"
fi
if [[ -z "$FN_NAME" || "$FN_NAME" == "None" ]]; then
  # Prefer the newest matching function if CFN lookup fails (orphans may exist).
  FN_NAME="$(
    aws lambda list-functions --region "$REGION" --output json \
      | python3 -c "
import json, sys
fns = [
  f for f in json.load(sys.stdin).get('Functions', [])
  if 'PsapProspectsHttpFunctio' in f.get('FunctionName', '')
]
fns.sort(key=lambda f: f.get('LastModified', ''), reverse=True)
print(fns[0]['FunctionName'] if fns else '')
"
  )"
fi
if [[ -z "$FN_NAME" || "$FN_NAME" == "None" ]]; then
  echo "ERROR: could not resolve PsapProspectsHttpFunction name" >&2
  exit 1
fi

FN_ARN="$(aws lambda get-function --function-name "$FN_NAME" --region "$REGION" --query 'Configuration.FunctionArn' --output text)"
ACCOUNT_ID="$(aws sts get-caller-identity --query Account --output text)"

echo "API=$API_ID FN=$FN_NAME AUTHZ=$AUTHZ_ID"

INT="$(
  aws apigatewayv2 create-integration \
    --api-id "$API_ID" \
    --integration-type AWS_PROXY \
    --integration-uri "arn:aws:apigateway:${REGION}:lambda:path/2015-03-31/functions/${FN_ARN}/invocations" \
    --payload-format-version "2.0" \
    --region "$REGION" \
    --query 'IntegrationId' --output text
)"
echo "Integration=$INT"

aws lambda add-permission \
  --function-name "$FN_NAME" \
  --statement-id "PsapProspectsHttpApiInvoke-$(date +%s)" \
  --action lambda:InvokeFunction \
  --principal apigateway.amazonaws.com \
  --source-arn "arn:aws:execute-api:${REGION}:${ACCOUNT_ID}:${API_ID}/*" \
  --region "$REGION" >/dev/null

# JMESPath RouteKey=='…/{psapId}' is unreliable; match in Python instead.
EXISTING_JSON="$(aws apigatewayv2 get-routes --api-id "$API_ID" --region "$REGION" --output json)"
export EXISTING_JSON

ROUTES=(
  "GET /api/rc-admin/psap-prospects"
  "GET /api/rc-admin/psap-prospects/stats"
  "GET /api/rc-admin/psap-prospects/export"
  "GET /api/rc-admin/psap-prospects/map-pins"
  "GET /api/rc-admin/psap-prospects/{psapId}"
  "PATCH /api/rc-admin/psap-prospects/{psapId}"
  "POST /api/rc-admin/psap-prospects/{psapId}/activities"
  "POST /api/rc-admin/psap-prospects/{psapId}/enrich-contacts"
  "POST /api/rc-admin/psap-prospects/enrich-all"
)

for key in "${ROUTES[@]}"; do
  existing="$(
    KEY="$key" python3 -c "
import json, os
key = os.environ['KEY']
items = json.loads(os.environ['EXISTING_JSON']).get('Items', [])
match = next((i for i in items if i.get('RouteKey') == key), None)
print(match['RouteId'] if match else '')
"
  )"
  if [[ -n "$existing" ]]; then
    echo "exists  $key ($existing)"
    continue
  fi
  rid="$(
    aws apigatewayv2 create-route \
      --api-id "$API_ID" \
      --route-key "$key" \
      --target "integrations/${INT}" \
      --authorization-type JWT \
      --authorizer-id "$AUTHZ_ID" \
      --region "$REGION" \
      --query 'RouteId' --output text
  )"
  echo "created $key → $rid"
done

code="$(curl -sS -o /tmp/psap-repair-probe.json -w "%{http_code}" \
  "https://${API_ID}.execute-api.${REGION}.amazonaws.com/api/rc-admin/psap-prospects" \
  -H "Accept: application/json" || true)"
echo "Probe (expect 401 without token): HTTP $code"
head -c 160 /tmp/psap-repair-probe.json 2>/dev/null || true
echo
