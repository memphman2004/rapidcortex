#!/usr/bin/env bash
# Readiness: signaling channel, endpoints, media storage, optional Kinesis video stream.
set -euo pipefail

REGION="${AWS_REGION:-}"
CHANNEL_NAME="${KVS_SIGNALING_CHANNEL_NAME:-}"
STREAM_NAME="${KVS_VIDEO_STREAM_NAME:-}"
# When true, require storage ENABLED and stream present with retention > 0
EXPECT_STORAGE="${KVS_CHECK_EXPECT_STORAGE:-false}"
FAIL=0
PROFILE_ARG=()

norm_bool() {
  x=$(printf '%s' "$1" | tr '[:upper:]' '[:lower:]')
  case "$x" in
    true|1|yes|on) echo "true" ;;
    *) echo "false" ;;
  esac
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --region) REGION="${2:-}"; shift 2 ;;
    --channel-name) CHANNEL_NAME="${2:-}"; shift 2 ;;
    --stream-name) STREAM_NAME="${2:-}"; shift 2 ;;
    --expect-storage) EXPECT_STORAGE="${2:-}"; shift 2 ;;
    --profile) PROFILE_ARG=(--profile "${2:-}"); shift 2 ;;
    -h|--help)
      echo "Usage: AWS_REGION=... KVS_SIGNALING_CHANNEL_NAME=... [KVS_VIDEO_STREAM_NAME=...] [KVS_CHECK_EXPECT_STORAGE=true] $0"
      exit 0
      ;;
    *) echo "Unknown: $1" >&2; exit 1 ;;
  esac
done

EXPECT_STORAGE="$(norm_bool "$EXPECT_STORAGE")"

if [[ -n "${AWS_PROFILE:-}" && ${#PROFILE_ARG[@]} -eq 0 ]]; then
  PROFILE_ARG=(--profile "${AWS_PROFILE}")
fi

if [[ -z "$REGION" || -z "$CHANNEL_NAME" ]]; then
  echo "FAIL: AWS_REGION and KVS_SIGNALING_CHANNEL_NAME are required"
  exit 1
fi

if ! command -v aws &>/dev/null; then
  echo "FAIL: AWS CLI not found"
  exit 1
fi
if [[ ${#PROFILE_ARG[@]} -gt 0 ]]; then
  if ! aws "${PROFILE_ARG[@]}" sts get-caller-identity --region "$REGION" &>/dev/null; then
    echo "FAIL: not authenticated"
    exit 1
  fi
  KVS=(aws kinesisvideo "${PROFILE_ARG[@]}" --region "$REGION")
else
  if ! aws sts get-caller-identity --region "$REGION" &>/dev/null; then
    echo "FAIL: not authenticated"
    exit 1
  fi
  KVS=(aws kinesisvideo --region "$REGION")
fi

if ! ch_json=$("${KVS[@]}" describe-signaling-channel --channel-name "$CHANNEL_NAME" --output json 2>&1); then
  echo "FAIL: describe-signaling-channel ($ch_json)"
  exit 1
fi
CH_ARN=$(printf '%s' "$ch_json" | python3 -c "import json,sys; j=json.load(sys.stdin); c=j.get('ChannelInfo')or{}; print(c.get('ChannelARN') or j.get('ChannelARN') or '')")
if [[ -z "$CH_ARN" ]]; then
  echo "FAIL: could not read channel ARN"
  exit 1
fi
echo "PASS: describe-signaling-channel (arn=$CH_ARN)"

if ! "${KVS[@]}" get-signaling-channel-endpoint \
  --channel-arn "$CH_ARN" \
  --single-master-channel-endpoint-configuration "Protocols=[WSS,HTTPS],Role=MASTER" \
  --output json &>/dev/null; then
  echo "FAIL: get-signaling-channel-endpoint (WSS+HTTPS, MASTER)"
  FAIL=1
else
  echo "PASS: get-signaling-channel-endpoint (WSS+HTTPS, MASTER)"
fi

# Optional: second check for viewer role (dispatcher path)
if "${KVS[@]}" get-signaling-channel-endpoint \
  --channel-arn "$CH_ARN" \
  --single-master-channel-endpoint-configuration "Protocols=[WSS,HTTPS],Role=VIEWER" \
  --output json &>/dev/null; then
  echo "PASS: get-signaling-channel-endpoint (WSS+HTTPS, VIEWER)"
else
  echo "FAIL: get-signaling-channel-endpoint (VIEWER)"
  FAIL=1
fi

ms_json=$("${KVS[@]}" describe-media-storage-configuration --channel-arn "$CH_ARN" --output json 2>/dev/null || echo '{}')
st=$(printf '%s' "$ms_json" | python3 -c "import json,sys; j=json.load(sys.stdin); m=j.get('MediaStorageConfiguration')or{}; print(m.get('Status') or 'UNKNOWN')")
echo "Media storage status on channel: $st"
if [[ "$st" == "ENABLED" ]]; then
  echo "PASS: media storage is ENABLED"
  map_ar=$(printf '%s' "$ms_json" | python3 -c "import json,sys; j=json.load(sys.stdin); m=j.get('MediaStorageConfiguration')or{}; print(m.get('StreamARN') or '')")
  if [[ -n "$map_ar" ]]; then
    echo "PASS: stream mapped: ${map_ar:0:80}..."
  else
    echo "FAIL: storage ENABLED but no StreamARN in response"
    FAIL=1
  fi
else
  echo "Storage is not ENABLED (live-only or not mapped)."
fi

# describe-mapped-resource-configuration uses stream name/arn (per AWS API)
if [[ -n "$STREAM_NAME" ]]; then
  if "${KVS[@]}" describe-mapped-resource-configuration --stream-name "$STREAM_NAME" --no-paginate --output json &>/dev/null; then
    echo "PASS: describe-mapped-resource-configuration (stream name)"
  else
    echo "INFO: describe-mapped-resource-configuration (empty or stream not yet mapped)"
  fi
else
  echo "SKIP: describe-mapped-resource-configuration (set KVS_VIDEO_STREAM_NAME to check stream mapping)"
fi

if [[ -n "$STREAM_NAME" ]]; then
  if ! s_json=$("${KVS[@]}" describe-stream --stream-name "$STREAM_NAME" --output json 2>&1); then
    echo "FAIL: describe-stream $STREAM_NAME"
    FAIL=1
  else
    ret=$(printf '%s' "$s_json" | python3 -c "import json,sys; j=json.load(sys.stdin); i=j.get('StreamInfo')or{}; print(int(i.get('DataRetentionInHours')or 0))")
    echo "Stream retention (hours, reported): $ret"
    if [[ "$ret" -gt 0 ]]; then
      echo "PASS: stream exists with retention > 0"
    else
      echo "FAIL: stream retention is 0 or missing"
      FAIL=1
    fi
  fi
else
  echo "SKIP: KVS_VIDEO_STREAM_NAME not set (not checking Kinesis video stream)"
fi

if [[ "$EXPECT_STORAGE" == "true" ]]; then
  if [[ "$st" != "ENABLED" ]]; then
    echo "FAIL: KVS_CHECK_EXPECT_STORAGE=true but storage is not ENABLED"
    FAIL=1
  fi
  if [[ -z "$STREAM_NAME" ]]; then
    echo "FAIL: expected storage but KVS_VIDEO_STREAM_NAME not set for stream check"
    FAIL=1
  fi
fi

if [[ "$FAIL" -ne 0 ]]; then
  echo "Overall: FAIL"
  exit 1
fi
echo "Overall: PASS"
exit 0
