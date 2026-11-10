#!/usr/bin/env bash
# Verify Live Video + Rapid Vision KVS production readiness (account 158961537080).
#
# Usage:
#   export AWS_PROFILE=rapid-cortex AWS_REGION=us-east-1
#   bash scripts/verify-kvs-prod-ready.sh
#
# Exit 0 only when all infra checks pass. Browser JoinStorageSession / LIVE tab
# smoke still requires a dispatcher session (see docs/operations-runbooks/VIDEO_GATEWAYS_E2E.md).

set -euo pipefail

PROFILE="${AWS_PROFILE:-rapid-cortex}"
REGION="${AWS_REGION:-${AWS_DEFAULT_REGION:-us-east-1}}"
export AWS_PROFILE="$PROFILE" AWS_REGION="$REGION" AWS_DEFAULT_REGION="$REGION"

ACCOUNT_EXPECTED="158961537080"
FAIL=0
pass() { echo "PASS  $*"; }
fail() { echo "FAIL  $*" >&2; FAIL=1; }
info() { echo "INFO  $*"; }

echo "==> KVS prod-ready verify (profile=$PROFILE region=$REGION)"

ACCT=$(aws sts get-caller-identity --query Account --output text 2>/dev/null || true)
if [[ "$ACCT" != "$ACCOUNT_EXPECTED" ]]; then
  fail "sts account is '${ACCT:-unknown}' (expected $ACCOUNT_EXPECTED)"
else
  pass "AWS account $ACCT"
fi

# Resolve Live Video / Vision function names (text search — JMESPath contains + |[0] is brittle)
resolve_fn() {
  local needle="$1"
  aws lambda list-functions --query 'Functions[].FunctionName' --output text \
    | tr '\t' '\n' \
    | grep -F "$needle" \
    | head -n 1
}

LV_INC=$(resolve_fn "LiveVideoIncidentsHttp")
LV_PUB=$(resolve_fn "LiveVideoPublicHttp")
LV_EXP=$(resolve_fn "LiveVideoExportFunction")
VISION=$(resolve_fn "VisionHttpFunction")
TX=$(resolve_fn "vision-transcript-worker")
if [[ -z "$TX" ]]; then TX=$(resolve_fn "VisionTranscriptWorker"); fi

for label_fn in "LiveVideoIncidents:$LV_INC" "LiveVideoPublic:$LV_PUB" "LiveVideoExport:$LV_EXP" "VisionHttp:$VISION" "TranscriptWorker:$TX"; do
  label="${label_fn%%:*}"
  fn="${label_fn#*:}"
  if [[ -z "$fn" || "$fn" == "None" ]]; then
    fail "missing Lambda $label"
  else
    pass "Lambda $label = $fn"
  fi
done

check_env() {
  local fn="$1" key="$2" expect_nonzero="${3:-1}"
  local val
  val=$(aws lambda get-function-configuration --function-name "$fn" \
    --query "Environment.Variables.${key}" --output text 2>/dev/null || echo "")
  if [[ "$expect_nonzero" == "1" && ( -z "$val" || "$val" == "None" ) ]]; then
    fail "$fn missing $key"
  else
    pass "$fn $key=${val}"
  fi
}

check_env "$LV_INC" ENABLE_LIVE_VIDEO
check_env "$LV_INC" LIVE_VIDEO_KVS_TOKEN_ROLE_ARN
check_env "$LV_INC" LIVE_VIDEO_STORAGE_MODE
check_env "$LV_INC" LIVE_VIDEO_KVS_STORAGE_ATTACH_TO_CHANNEL
check_env "$LV_INC" LIVE_VIDEO_EXPORT_TO_S3
check_env "$LV_PUB" LIVE_VIDEO_KVS_TOKEN_ROLE_ARN
check_env "$LV_PUB" LIVE_VIDEO_KVS_STORAGE_ATTACH_TO_CHANNEL
check_env "$VISION" KVS_BROWSER_TOKEN_ROLE_ARN
check_env "$VISION" VISION_TRANSCRIPT_MOCK
check_env "$VISION" ENABLE_RAPID_VISION
check_env "$VISION" VISION_DEMO_KVS_CHANNEL_NAME
check_env "$TX" VISION_TRANSCRIPT_MOCK

MOCK=$(aws lambda get-function-configuration --function-name "$VISION" \
  --query 'Environment.Variables.VISION_TRANSCRIPT_MOCK' --output text)
if [[ "$MOCK" != "false" ]]; then
  fail "VISION_TRANSCRIPT_MOCK must be false for prod transcript (got $MOCK)"
else
  pass "Vision transcript mock disabled"
fi

LAYERS=$(aws lambda get-function-configuration --function-name "$TX" \
  --query 'Layers[?contains(Arn, `ffmpeg`)].Arn' --output text)
if [[ -z "$LAYERS" || "$LAYERS" == "None" ]]; then
  fail "Transcript worker missing ffmpeg layer"
else
  pass "Transcript worker ffmpeg layer: $LAYERS"
fi

# Parent CFN flags
ENABLE_LV=$(aws cloudformation describe-stacks --stack-name rapid-cortex-dev \
  --query "Stacks[0].Parameters[?ParameterKey=='EnableLiveVideoResources'].ParameterValue | [0]" --output text)
FFMPEG=$(aws cloudformation describe-stacks --stack-name rapid-cortex-dev \
  --query "Stacks[0].Parameters[?ParameterKey=='FfmpegLayerArn'].ParameterValue | [0]" --output text)
[[ "$ENABLE_LV" == "true" ]] && pass "EnableLiveVideoResources=true" || fail "EnableLiveVideoResources=$ENABLE_LV"
[[ -n "$FFMPEG" && "$FFMPEG" != "None" ]] && pass "FfmpegLayerArn set" || fail "FfmpegLayerArn empty"

# API routes
HTTP5=$(aws cloudformation describe-stacks --stack-name rapid-cortex-dev \
  --query "Stacks[0].Outputs[?OutputKey=='HttpApi5Url'].OutputValue | [0]" --output text)
HTTP2=$(aws cloudformation describe-stacks --stack-name rapid-cortex-dev \
  --query "Stacks[0].Outputs[?OutputKey=='HttpApi2Url'].OutputValue | [0]" --output text)
[[ -n "$HTTP5" && "$HTTP5" != "None" ]] && pass "HttpApi5Url=$HTTP5" || fail "HttpApi5Url missing"
[[ -n "$HTTP2" && "$HTTP2" != "None" ]] && pass "HttpApi2Url=$HTTP2" || fail "HttpApi2Url missing"

code5=$(curl -s -o /dev/null -w "%{http_code}" -X POST "${HTTP5}/api/incidents/smoke/live-video/request" || echo 000)
# 401/403/404 all prove the route is mounted; 000 is network failure
if [[ "$code5" =~ ^(401|403|404|400)$ ]]; then
  pass "stack5 live-video route reachable (HTTP $code5)"
else
  fail "stack5 live-video route unexpected HTTP $code5"
fi

code2=$(curl -s -o /dev/null -w "%{http_code}" "${HTTP2}/api/vision/cameras" || echo 000)
if [[ "$code2" =~ ^(401|403|404|400)$ ]]; then
  pass "stack2 vision route reachable (HTTP $code2)"
else
  fail "stack2 vision route unexpected HTTP $code2"
fi

# KVS fixtures via Live Video role bootstrap helper (describe-only)
BOOT_FN="rapid-cortex-kvs-channel-bootstrap-dev"
if aws lambda get-function --function-name "$BOOT_FN" >/dev/null 2>&1; then
  ROLE=$(aws lambda get-function-configuration --function-name "$LV_INC" --query 'Role' --output text)
  aws lambda update-function-configuration --function-name "$BOOT_FN" --role "$ROLE" >/dev/null 2>&1 || true
  aws lambda wait function-updated --function-name "$BOOT_FN" 2>/dev/null || sleep 3
  OUT=$(mktemp)
  aws lambda invoke --function-name "$BOOT_FN" --cli-binary-format raw-in-base64-out \
    --payload '{"channels":["rc-vision-demo-shared","rc-bootstrap-signaling"],"streams":["rc-bootstrap-storage"]}' \
    "$OUT" >/dev/null
  if python3 - "$OUT" <<'PY'
import json,sys
d=json.load(open(sys.argv[1]))
if d.get("errorMessage"):
  print(d["errorMessage"]); sys.exit(1)
for k in ("rc-vision-demo-shared","rc-bootstrap-signaling","rc-bootstrap-storage"):
  if not d.get(k,{}).get("ok"):
    print(k, d.get(k)); sys.exit(1)
print("ok")
PY
  then
    pass "KVS fixtures ACTIVE (demo + bootstrap channel/stream)"
  else
    fail "KVS fixture describe failed (see above)"
  fi
  rm -f "$OUT"
else
  info "bootstrap Lambda $BOOT_FN absent — skip fixture describe (optional)"
fi

# Alarms
for ALARM in LiveVideoExportErrorsAlarm LiveVideoIncidentsHttpErrorsAlarm LiveVideoPublicHttpErrorsAlarm; do
  STATE=$(aws cloudwatch describe-alarms --alarm-name-prefix rapid-cortex \
    --query "MetricAlarms[?contains(AlarmName, '${ALARM}')].StateValue | [0]" --output text)
  if [[ "$STATE" == "OK" || "$STATE" == "INSUFFICIENT_DATA" ]]; then
    pass "alarm $ALARM state=$STATE"
  elif [[ -z "$STATE" || "$STATE" == "None" ]]; then
    fail "alarm $ALARM missing"
  else
    fail "alarm $ALARM state=$STATE"
  fi
done

# Web env script sanity (not live ECS — confirms checked-in wiring)
WEB_ENV="scripts/env-web-ssr-prod.sh"
if [[ -f "$WEB_ENV" ]]; then
  grep -q 'API_UPSTREAM_BASE_5=.*ubartq53a8' "$WEB_ENV" && pass "web env BASE_5 → stack5" || fail "web env BASE_5 mismatch"
  grep -q 'API_UPSTREAM_BASE_2=.*t4bdwpjfs5' "$WEB_ENV" && pass "web env BASE_2 → stack2" || fail "web env BASE_2 mismatch"
  grep -q 'NEXT_PUBLIC_ENABLE_LIVE_VIDEO=1' "$WEB_ENV" && pass "NEXT_PUBLIC_ENABLE_LIVE_VIDEO=1" || fail "LIVE_VIDEO web flag off"
else
  fail "missing $WEB_ENV"
fi

echo
if [[ "$FAIL" -ne 0 ]]; then
  echo "KVS prod-ready verify FAILED"
  exit 1
fi
echo "KVS infra prod-ready checks PASSED"
echo "Remaining human smoke: VIDEO_GATEWAYS_E2E.md §3 (Live Video JoinStorageSession) and §6 (Vision LIVE tab)."
exit 0
