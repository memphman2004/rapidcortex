#!/usr/bin/env bash
# Live web ECS deploy — run in macOS Terminal if Cursor sandbox blocks agent:
#   bash "/Volumes/Mac Mini/Coding Projects/Rapid Cortex/.war-room-staging/deploy-web-ecs-dev.sh"
set -euo pipefail
export AWS_PROFILE="${AWS_PROFILE:-rapid-cortex}"
export AWS_REGION="${AWS_REGION:-us-east-1}"
export AWS_DEFAULT_REGION="$AWS_REGION"
export ALLOW_EXTERNAL_DRIVE=1
unset HTTP_PROXY HTTPS_PROXY http_proxy https_proxy ALL_PROXY all_proxy no_proxy NO_PROXY || true

ROOT="/Volumes/Mac Mini/Coding Projects/Rapid Cortex"
LOG="${HOME}/.rapid-cortex-sam-build/deploy-web-ecs-dev.log"
EXITF="${HOME}/.rapid-cortex-sam-build/deploy-web-ecs-dev-exit.txt"
mkdir -p "${HOME}/.rapid-cortex-sam-build"
rm -f "$EXITF"
cd "$ROOT"
{
  echo "########## WEB_ECS_DEV $(date -u +%Y-%m-%dT%H:%M:%SZ) ##########"
  bash "$ROOT/scripts/deploy-web-ecs.sh" dev
  ec=$?
  echo "$ec" > "$EXITF"
  echo "WEB_ECS_EXIT=$ec"
  exit "$ec"
} 2>&1 | tee -a "$LOG"
