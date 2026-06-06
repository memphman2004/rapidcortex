#!/usr/bin/env bash
set -euo pipefail

RTSP_URL="${RTSP_URL:?RTSP_URL required}"
KVS_CHANNEL_NAME="${KVS_CHANNEL_NAME:?KVS_CHANNEL_NAME required}"
KVS_REGION="${KVS_REGION:-us-east-1}"
SESSION_ID="${SESSION_ID:?SESSION_ID required}"
INCIDENT_ID="${INCIDENT_ID:?INCIDENT_ID required}"
PRODUCT="${PRODUCT:-connect}"
SESSIONS_TABLE="${SESSIONS_TABLE:?SESSIONS_TABLE required}"

log() { echo "[bridge:${SESSION_ID:0:8}] $*"; }
log_safe_url() {
  echo "$1" | sed 's|rtsp://[^@]*@|rtsp://***@|'
}

log "Starting - product=$PRODUCT incident=$INCIDENT_ID channel=$KVS_CHANNEL_NAME"
log "Source: $(log_safe_url "$RTSP_URL")"

if [[ -n "${CREDENTIALS_SECRET_ARN:-}" ]]; then
  log "Resolving credentials from Secrets Manager..."
  SECRET=$(aws secretsmanager get-secret-value \
    --secret-id "$CREDENTIALS_SECRET_ARN" \
    --region "$KVS_REGION" \
    --query SecretString \
    --output text)
  USERNAME=$(echo "$SECRET" | python3 -c "import json,sys;d=json.load(sys.stdin);print(d['username'])")
  PASSWORD=$(echo "$SECRET" | python3 -c "import json,sys;d=json.load(sys.stdin);print(d['password'])")
  if [[ "$RTSP_URL" != rtsp://*@* ]]; then
    RTSP_URL=$(echo "$RTSP_URL" | sed "s|rtsp://|rtsp://${USERNAME}:${PASSWORD}@|")
  fi
  unset SECRET USERNAME PASSWORD
  log "Credentials resolved"
fi

report_status() {
  local status="$1"
  aws dynamodb update-item \
    --table-name "$SESSIONS_TABLE" \
    --key '{"pk":{"S":"SESSION#'"$SESSION_ID"'"},"sk":{"S":"PROFILE"}}' \
    --update-expression "SET bridgeStatus = :s, bridgeUpdatedAt = :t" \
    --expression-attribute-values '{":s":{"S":"'"$status"'"},":t":{"S":"'"$(date -u +%Y-%m-%dT%H:%M:%SZ)"'"}}' \
    --region "$KVS_REGION" 2>/dev/null || true
}

build_pipeline() {
  local url="$1"
  echo "rtspsrc location=\"${url}\" latency=200 protocols=tcp drop-on-latency=true \
    ! rtph264depay \
    ! h264parse \
    ! kvssink \
        stream-name=\"${KVS_CHANNEL_NAME}\" \
        aws-region=\"${KVS_REGION}\" \
        storage-size=0 \
        fragment-duration=2000 \
        iot-certificate=\"\" \
        log-config=\"\""
}

echo $$ > /tmp/bridge.pid
report_status "STARTING"

ATTEMPT=0
MAX_ATTEMPTS=5
BACKOFF=5

while [[ $ATTEMPT -lt $MAX_ATTEMPTS ]]; do
  ATTEMPT=$((ATTEMPT + 1))
  log "Pipeline attempt ${ATTEMPT}/${MAX_ATTEMPTS}"
  report_status "RUNNING"
  # shellcheck disable=SC2086
  if GST_DEBUG=2 gst-launch-1.0 -v $(build_pipeline "$RTSP_URL"); then
    log "Pipeline exited cleanly"
    break
  fi

  log "Pipeline failed (attempt ${ATTEMPT}/${MAX_ATTEMPTS})"
  report_status "RETRYING"

  if [[ $ATTEMPT -lt $MAX_ATTEMPTS ]]; then
    log "Retrying in ${BACKOFF}s..."
    sleep "$BACKOFF"
    BACKOFF=$((BACKOFF * 2))
  fi
done

report_status "STOPPED"
log "Bridge agent exiting"
rm -f /tmp/bridge.pid
