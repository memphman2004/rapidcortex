#!/usr/bin/env bash
# Idempotent: Kinesis Video Streams signaling channel + optional video stream and storage mapping.
# Rapid Cortex production also creates per-session channels via the API; this script is for
# operator bootstrap, staging defaults, and alignment checks (named resources).
set -euo pipefail

usage() {
  cat <<'EOF'
Environment:
  AWS_REGION                 (required)
  KVS_SIGNALING_CHANNEL_NAME (required)
  KVS_ENABLE_STORAGE         true|false (default: false)
  KVS_VIDEO_STREAM_NAME      (required if storage enabled)
  KVS_STREAM_RETENTION_HOURS (default: 24; min 1 when storage on)
  AWS_PROFILE                (optional)

Args: --region R --channel-name C [--enable-storage true|false] [--stream-name S] [--retention-hours N] [--profile P]
EOF
}

REGION="${AWS_REGION:-}"
CHANNEL_NAME="${KVS_SIGNALING_CHANNEL_NAME:-}"
ENABLE_STORAGE="${KVS_ENABLE_STORAGE:-false}"
STREAM_NAME="${KVS_VIDEO_STREAM_NAME:-}"
RETENTION_HOURS="${KVS_STREAM_RETENTION_HOURS:-24}"
PROFILE_ARG=()

while [[ $# -gt 0 ]]; do
  case "$1" in
    --region) REGION="${2:-}"; shift 2 ;;
    --channel-name) CHANNEL_NAME="${2:-}"; shift 2 ;;
    --enable-storage) ENABLE_STORAGE="${2:-}"; shift 2 ;;
    --stream-name) STREAM_NAME="${2:-}"; shift 2 ;;
    --retention-hours) RETENTION_HOURS="${2:-}"; shift 2 ;;
    --profile) PROFILE_ARG=(--profile "${2:-}"); shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown: $1" >&2; usage; exit 1 ;;
  esac
done

if [[ -n "${AWS_PROFILE:-}" && ${#PROFILE_ARG[@]} -eq 0 ]]; then
  PROFILE_ARG=(--profile "${AWS_PROFILE}")
fi

norm_bool() {
  x=$(printf '%s' "$1" | tr '[:upper:]' '[:lower:]')
  case "$x" in
    true|1|yes|on) echo "true" ;;
    *) echo "false" ;;
  esac
}

ENABLE_STORAGE="$(norm_bool "$ENABLE_STORAGE")"

if [[ -z "$REGION" || -z "$CHANNEL_NAME" ]]; then
  echo "ERROR: AWS_REGION and KVS_SIGNALING_CHANNEL_NAME (or --region / --channel-name) are required." >&2
  exit 1
fi

if [[ "$ENABLE_STORAGE" == "true" ]]; then
  if [[ -z "$STREAM_NAME" ]]; then
    echo "ERROR: KVS_VIDEO_STREAM_NAME (or --stream-name) is required when storage is enabled." >&2
    exit 1
  fi
  RETENTION_HOURS=$((10#$RETENTION_HOURS))
  if [[ "$RETENTION_HOURS" -lt 1 ]]; then
    echo "ERROR: KVS_STREAM_RETENTION_HOURS must be >= 1" >&2
    exit 1
  fi
fi

if ! command -v aws &>/dev/null; then
  echo "ERROR: AWS CLI not found" >&2
  exit 1
fi
if [[ ${#PROFILE_ARG[@]} -gt 0 ]]; then
  if ! aws "${PROFILE_ARG[@]}" sts get-caller-identity --region "$REGION" &>/dev/null; then
    echo "ERROR: AWS CLI not authenticated" >&2
    exit 1
  fi
  KVS=(aws kinesisvideo "${PROFILE_ARG[@]}" --region "$REGION")
else
  if ! aws sts get-caller-identity --region "$REGION" &>/dev/null; then
    echo "ERROR: AWS CLI not authenticated" >&2
    exit 1
  fi
  KVS=(aws kinesisvideo --region "$REGION")
fi

read_channel_arn() {
  "${KVS[@]}" describe-signaling-channel --channel-name "$CHANNEL_NAME" --output json \
    | python3 -c "import json,sys; j=json.load(sys.stdin); c=j.get('ChannelInfo')or{}; print(c.get('ChannelARN') or j.get('ChannelARN') or '')"
}

ensure_signaling_channel() {
  if "${KVS[@]}" describe-signaling-channel --channel-name "$CHANNEL_NAME" --output json &>/dev/null; then
    echo "Reusing existing signaling channel: $CHANNEL_NAME" >&2
  else
    echo "Creating signaling channel: $CHANNEL_NAME" >&2
    "${KVS[@]}" create-signaling-channel \
      --channel-name "$CHANNEL_NAME" \
      --channel-type SINGLE_MASTER \
      --single-master-configuration MessageTtlSeconds=60 \
      --output json >/dev/null
  fi
  CHANNEL_ARN="$(read_channel_arn)"
  if [[ -z "$CHANNEL_ARN" ]]; then
    echo "ERROR: could not resolve channel ARN" >&2
    exit 1
  fi
}

stream_arn_by_name() {
  "${KVS[@]}" describe-stream --stream-name "$1" --output json | python3 -c "import json,sys; j=json.load(sys.stdin); print(j.get('StreamInfo',{}).get('StreamARN') or '')"
}

ensure_stream() {
  if "${KVS[@]}" describe-stream --stream-name "$STREAM_NAME" --output json &>/dev/null; then
    echo "Reusing existing video stream: $STREAM_NAME" >&2
  else
    echo "Creating video stream: $STREAM_NAME (retention ${RETENTION_HOURS}h)" >&2
    "${KVS[@]}" create-stream --stream-name "$STREAM_NAME" --data-retention-in-hours "$RETENTION_HOURS" --output json >/dev/null
  fi
  STREAM_ARN="$(stream_arn_by_name "$STREAM_NAME")"
  if [[ -z "$STREAM_ARN" ]]; then
    echo "ERROR: could not resolve stream ARN" >&2
    exit 1
  fi
}

ensure_signaling_channel

if [[ "$ENABLE_STORAGE" == "true" ]]; then
  ensure_stream
  echo "Enabling media storage: channel -> stream" >&2
  "${KVS[@]}" update-media-storage-configuration \
    --channel-arn "$CHANNEL_ARN" \
    --media-storage-configuration "StreamARN=${STREAM_ARN},Status=ENABLED" \
    --output json >/dev/null
else
  echo "Storage disabled: updating channel to disable mapped storage (if supported)" >&2
  if ! "${KVS[@]}" update-media-storage-configuration \
    --channel-arn "$CHANNEL_ARN" \
    --media-storage-configuration "Status=DISABLED" \
    --output json 2>/dev/null; then
    echo "NOTE: Could not set DISABLED (channel may have no prior mapping). This is normal for a new channel." >&2
  fi
  STREAM_ARN="(n/a — storage not enabled in this run)"
fi

echo ""
echo "=== KVS WebRTC summary ==="
echo "Region:                 $REGION"
echo "Signaling channel name: $CHANNEL_NAME"
echo "Signaling channel ARN:  $CHANNEL_ARN"
echo "Storage in this run:   $ENABLE_STORAGE"
if [[ "$ENABLE_STORAGE" == "true" ]]; then
  echo "Video stream name:      $STREAM_NAME"
  echo "Video stream ARN:       $STREAM_ARN"
  echo "Retention (hours):      $RETENTION_HOURS"
else
  echo "Video stream:            $STREAM_ARN"
fi
echo ""
echo "When storage is ENABLED, use JoinStorageSession (not plain master/viewer) in clients — see docs/kvs-webrtc-setup.md."
echo "Rapid Cortex can still create per-session channels via the API; this script targets named shared resources for ops/staging."
