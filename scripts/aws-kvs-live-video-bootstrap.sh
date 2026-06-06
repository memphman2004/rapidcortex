#!/usr/bin/env bash
# Optional: create fixed Kinesis Video resources via AWS CLI (sandbox / ops checks).
#
# Rapid Cortex production still creates per-session channels (rc-live-*) and streams
# (rc-lvsv-*) from the API when dispatchers request live video. This script does NOT
# wire those names into the app—it only provisions named fixtures in your account.
#
# Usage:
#   export AWS_REGION=us-east-2   # same region as your stack
#   ./scripts/aws-kvs-live-video-bootstrap.sh
#
# Optional overrides:
#   KVS_BOOTSTRAP_SIGNALING_CHANNEL_NAME   default: rc-bootstrap-signaling
#   KVS_BOOTSTRAP_STORAGE_STREAM_NAME      default: rc-bootstrap-storage
#   KVS_BOOTSTRAP_STREAM_RETENTION_HOURS   default: 168 (7 days)

set -euo pipefail

REGION="${AWS_REGION:-${AWS_DEFAULT_REGION:-}}"
if [[ -z "${REGION}" ]]; then
  echo "Set AWS_REGION (or AWS_DEFAULT_REGION) to the same region as Rapid Cortex, e.g. export AWS_REGION=us-east-2" >&2
  exit 1
fi

CHANNEL_NAME="${KVS_BOOTSTRAP_SIGNALING_CHANNEL_NAME:-rc-bootstrap-signaling}"
STREAM_NAME="${KVS_BOOTSTRAP_STORAGE_STREAM_NAME:-rc-bootstrap-storage}"
RETENTION_HOURS="${KVS_BOOTSTRAP_STREAM_RETENTION_HOURS:-168}"

if ! command -v aws >/dev/null 2>&1; then
  echo "aws CLI not found" >&2
  exit 1
fi

echo "Region: ${REGION}"

if aws kinesisvideo describe-signaling-channel --channel-name "${CHANNEL_NAME}" --region "${REGION}" &>/dev/null; then
  echo "Signaling channel already exists: ${CHANNEL_NAME}"
  aws kinesisvideo describe-signaling-channel --channel-name "${CHANNEL_NAME}" --region "${REGION}" \
    --query 'ChannelInfo.ChannelARN' --output text
else
  echo "Creating signaling channel: ${CHANNEL_NAME} (SINGLE_MASTER, MessageTtlSeconds=60)"
  aws kinesisvideo create-signaling-channel \
    --region "${REGION}" \
    --channel-name "${CHANNEL_NAME}" \
    --channel-type SINGLE_MASTER \
    --single-master-configuration "MessageTtlSeconds=60"
fi

if aws kinesisvideo describe-stream --stream-name "${STREAM_NAME}" --region "${REGION}" &>/dev/null; then
  echo "Video stream already exists: ${STREAM_NAME}"
  aws kinesisvideo describe-stream --stream-name "${STREAM_NAME}" --region "${REGION}" \
    --query 'StreamInfo.StreamARN' --output text
else
  echo "Creating video stream: ${STREAM_NAME} (retention ${RETENTION_HOURS}h)"
  aws kinesisvideo create-stream \
    --region "${REGION}" \
    --stream-name "${STREAM_NAME}" \
    --data-retention-in-hours "${RETENTION_HOURS}"
fi

echo "Done. List in console: Kinesis Video Streams → Signaling channels / Video streams (${REGION})."
