#!/usr/bin/env bash
# Run this in macOS Terminal (not Cursor agent):
#   bash "/Volumes/Mac Mini/Coding Projects/Rapid Cortex/.war-room-staging/restart-call-assist-deploy.sh"
set -euo pipefail

export AWS_PROFILE="${AWS_PROFILE:-rapid-cortex}"
export AWS_REGION="${AWS_REGION:-us-east-1}"
export AWS_DEFAULT_REGION="$AWS_REGION"
export ALLOW_EXTERNAL_DRIVE=1
export SAM_BUILD_DIR="${HOME}/.rapid-cortex-sam-build/current"
unset HTTP_PROXY HTTPS_PROXY http_proxy https_proxy ALL_PROXY all_proxy no_proxy NO_PROXY || true

ROOT="/Volumes/Mac Mini/Coding Projects/Rapid Cortex"
LOG="${HOME}/.rapid-cortex-sam-build/call-assist-phase1-deploy.log"
EXITF="${HOME}/.rapid-cortex-sam-build/call-assist-phase1-exit.txt"

echo "→ Stopping any overlapping Call Assist deploys…"
pkill -f 'scripts/deploy-call-assist-phase1.sh' 2>/dev/null || true
pkill -f 'sam build --template-file .*stack-app-sam-call-assist' 2>/dev/null || true
sleep 2
rm -f /tmp/rapid-cortex-api-vendor.lock "$EXITF"
mkdir -p "${HOME}/.rapid-cortex-sam-build" "$SAM_BUILD_DIR"

echo "→ Starting single deploy (log: $LOG)"
echo "" >> "$LOG"
echo "########## MANUAL_CLEAN_RUN $(date -u +%Y-%m-%dT%H:%M:%SZ) ##########" >> "$LOG"
bash "$ROOT/scripts/deploy-call-assist-phase1.sh"
ec=$?
echo "$ec" > "$EXITF"
echo "CALL_ASSIST_EXIT=$ec"
exit "$ec"
