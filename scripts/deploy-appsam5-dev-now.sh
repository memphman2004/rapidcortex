#!/bin/bash
set -euo pipefail
cd "/Volumes/Mac Mini/Coding Projects/Rapid Cortex"
unset HTTP_PROXY HTTPS_PROXY http_proxy https_proxy ALL_PROXY all_proxy
export AWS_PROFILE=default
export AWS_REGION=us-east-1
export AWS_DEFAULT_REGION=us-east-1
source scripts/env-api-dev.sh
export AWS_PROFILE=default
export SKIP_APP_SAM_SIZE_PROXY=1
export ALLOW_EXTERNAL_DRIVE=1
export SAM_BUILD_DIR="${HOME}/.rapid-cortex-sam-build-lean"
mkdir -p "$SAM_BUILD_DIR"
LOG="${HOME}/.rapid-cortex-sam-build-lean/appsam5-deploy.log"
echo "=== AppSam5 lean deploy ($(date)) ===" | tee "$LOG"
bash scripts/deploy-lean-dev.sh dev --sam5-only 2>&1 | tee -a "$LOG"
echo "EXIT=${PIPESTATUS[0]}" | tee -a "$LOG"
echo "=== done $(date) ===" | tee -a "$LOG"
