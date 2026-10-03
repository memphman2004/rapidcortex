#!/usr/bin/env bash
# RC Translate — full-deps surgical redeploy (HTTP + WS) for live/dev.
# Avoids SAM_LEAN_BUILD so rapid-cortex-shared is packaged into both Lambdas.
#   source scripts/env-api-dev.sh && bash scripts/deploy-translate-hotfix.sh
set -euo pipefail

export AWS_PROFILE="${AWS_PROFILE:-rapid-cortex}"
export AWS_REGION="${AWS_REGION:-us-east-1}"
export AWS_DEFAULT_REGION="${AWS_REGION}"
unset HTTP_PROXY HTTPS_PROXY http_proxy https_proxy ALL_PROXY all_proxy no_proxy NO_PROXY || true

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

LOG="${HOME}/.rapid-cortex-sam-build/translate-hotfix-deploy.log"
mkdir -p "$(dirname "$LOG")"
exec > >(tee -a "$LOG") 2>&1

echo "═══════════════════════════════════════════════════════"
echo " Translate hotfix deploy (full node_modules)"
echo " ROOT=$ROOT"
echo " $(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo "═══════════════════════════════════════════════════════"

# Prefer env-api-dev when present
if [[ -f "$ROOT/scripts/env-api-dev.sh" ]]; then
  # shellcheck source=/dev/null
  source "$ROOT/scripts/env-api-dev.sh"
fi

# shellcheck source=scripts/lib/api-vendor-lock.sh
source "${ROOT}/scripts/lib/api-vendor-lock.sh"
# shellcheck source=scripts/lib/prepare-api-vendor-for-sam.sh
source "${ROOT}/scripts/lib/prepare-api-vendor-for-sam.sh"
rc_acquire_api_vendor_lock
REVERT_API_PKG=0
cleanup() {
  if [[ "${REVERT_API_PKG:-0}" -eq 1 && -f "${ROOT}/apps/api/package.json.pre-translate-hotfix" ]]; then
    mv "${ROOT}/apps/api/package.json.pre-translate-hotfix" "${ROOT}/apps/api/package.json"
  fi
  exec 9>&- 2>/dev/null || true
}
trap cleanup EXIT

echo "▶ Ensure translate-connections table exists"
TABLE="rapid-cortex-translate-connections-${DEPLOYMENT_STAGE:-dev}"
if ! aws dynamodb describe-table --table-name "$TABLE" --region "$AWS_REGION" >/dev/null 2>&1; then
  echo "  Creating $TABLE"
  aws dynamodb create-table \
    --table-name "$TABLE" \
    --billing-mode PAY_PER_REQUEST \
    --attribute-definitions \
      AttributeName=connectionId,AttributeType=S \
      AttributeName=sessionId,AttributeType=S \
    --key-schema AttributeName=connectionId,KeyType=HASH \
    --global-secondary-indexes \
      'IndexName=bySession,KeySchema=[{AttributeName=sessionId,KeyType=HASH}],Projection={ProjectionType=ALL}' \
    --region "$AWS_REGION" >/dev/null
  aws dynamodb wait table-exists --table-name "$TABLE" --region "$AWS_REGION"
  aws dynamodb update-time-to-live \
    --table-name "$TABLE" \
    --time-to-live-specification Enabled=true,AttributeName=ttl \
    --region "$AWS_REGION" >/dev/null || true
fi
echo "  $TABLE OK"

echo "▶ Vendor refresh + API tsc (no SAM_LEAN)"
unset SAM_LEAN_BUILD SAM4_LEAN_BUILD || true
RC_API_PKG_BACKUP_SUFFIX=pre-translate-hotfix rc_prepare_api_vendor_for_sam
REVERT_API_PKG="${REVERT_API_PKG:-1}"
npm run build -w rapid-cortex-api

BUILD_DIR="${SAM_BUILD_DIR:-$HOME/.rapid-cortex-sam-build/current}/translate-hotfix"
mkdir -p "$BUILD_DIR"
STAGE_DIR="$BUILD_DIR/stage"
rm -rf "$STAGE_DIR"
mkdir -p "$STAGE_DIR"

echo "▶ Stage full package (dist + node_modules)"
COPYFILE_DISABLE=1 rsync -a --delete \
  --exclude '.bin' \
  "$ROOT/apps/api/dist/" "$STAGE_DIR/dist/"
cp "$ROOT/apps/api/package.json" "$STAGE_DIR/package.json"
COPYFILE_DISABLE=1 rsync -aL \
  "$ROOT/apps/api/node_modules/" "$STAGE_DIR/node_modules/"

test -d "$STAGE_DIR/node_modules/rapid-cortex-shared" || {
  echo "ERROR: rapid-cortex-shared missing from staged node_modules" >&2
  exit 1
}
test -f "$STAGE_DIR/dist/handlers/translate/http.js"
test -f "$STAGE_DIR/dist/handlers/translate/ws.js"

ZIP="$BUILD_DIR/translate-full.zip"
rm -f "$ZIP"
(cd "$STAGE_DIR" && zip -qr "$ZIP" dist package.json node_modules)
echo "  zip=$(wc -c < "$ZIP") bytes"

HTTP_FN="$(aws lambda list-functions --region "$AWS_REGION" \
  --query "Functions[?contains(FunctionName, 'TranslateHttp')].FunctionName | [0]" --output text)"
WS_FN="$(aws lambda list-functions --region "$AWS_REGION" \
  --query "Functions[?contains(FunctionName, 'TranslateWs')].FunctionName | [0]" --output text)"

echo "▶ Update $HTTP_FN"
aws lambda update-function-code --function-name "$HTTP_FN" --zip-file "fileb://${ZIP}" --region "$AWS_REGION" \
  --query '{LastModified:LastModified,CodeSize:CodeSize}' --output json
aws lambda wait function-updated --function-name "$HTTP_FN" --region "$AWS_REGION"

echo "▶ Update $WS_FN"
aws lambda update-function-code --function-name "$WS_FN" --zip-file "fileb://${ZIP}" --region "$AWS_REGION" \
  --query '{LastModified:LastModified,CodeSize:CodeSize}' --output json
aws lambda wait function-updated --function-name "$WS_FN" --region "$AWS_REGION"

echo "▶ Smoke invoke"
HTTP_FN="$HTTP_FN" WS_FN="$WS_FN" python3 <<'PY'
import json, os, boto3
client = boto3.client("lambda", region_name=os.environ.get("AWS_REGION", "us-east-1"))
http = os.environ["HTTP_FN"]
ws = os.environ["WS_FN"]

def inv(name, event):
    r = client.invoke(FunctionName=name, Payload=json.dumps(event).encode())
    body = r["Payload"].read().decode()
    if r.get("FunctionError"):
        raise SystemExit(f"{name} {r['FunctionError']}: {body[:400]}")
    p = json.loads(body)
    print(name[-40:], p.get("statusCode"), str(p.get("body", ""))[:80])
    return p

inv(http, {
  "version": "2.0",
  "routeKey": "GET /api/translate/{proxy+}",
  "rawPath": "/api/translate/languages",
  "headers": {"accept": "application/json"},
  "requestContext": {
    "http": {"method": "GET", "path": "/api/translate/languages", "sourceIp": "127.0.0.1", "userAgent": "hotfix"},
    "requestId": "hotfix", "accountId": "1", "apiId": "x", "domainName": "x", "stage": "$default",
    "time": "x", "timeEpoch": 1, "routeKey": "GET /api/translate/{proxy+}",
  },
  "isBase64Encoded": False,
})
inv(http, {
  "version": "2.0",
  "routeKey": "GET /api/translate/{proxy+}",
  "rawPath": "/api/translate/assistance/summary",
  "headers": {"accept": "application/json"},
  "requestContext": {
    "http": {"method": "GET", "path": "/api/translate/assistance/summary", "sourceIp": "127.0.0.1", "userAgent": "hotfix"},
    "requestId": "hotfix", "accountId": "1", "apiId": "x", "domainName": "x", "stage": "$default",
    "time": "x", "timeEpoch": 1, "routeKey": "GET /api/translate/{proxy+}",
  },
  "isBase64Encoded": False,
})
p = inv(ws, {
  "requestContext": {
    "connectionId": "hotfix",
    "eventType": "CONNECT",
    "routeKey": "$connect",
    "domainName": "x",
    "stage": "dev",
  },
  "queryStringParameters": {},
})
assert p.get("statusCode") in (200, 401, 403, 503), p
print("smoke OK")
PY

echo "✅ Translate hotfix complete — log $LOG"
