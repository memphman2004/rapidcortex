#!/usr/bin/env bash
set -euo pipefail
STACK="rapid-cortex-dev"
REGION="us-east-1"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOG="/tmp/cognito-recovery-watch.log"
POLL_SEC=120
MAX_WAIT_SEC=$((6 * 60 * 60))
START=$(date +%s)

log() { echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] $*" | tee -a "$LOG"; }

status() {
  aws cloudformation describe-stacks \
    --stack-name "$STACK" \
    --region "$REGION" \
    --query 'Stacks[0].StackStatus' \
    --output text 2>/dev/null || echo "UNKNOWN"
}

log "Watcher started (poll every ${POLL_SEC}s, max ${MAX_WAIT_SEC}s)"

while true; do
  NOW=$(date +%s)
  ELAPSED=$((NOW - START))
  if (( ELAPSED > MAX_WAIT_SEC )); then
    log "TIMEOUT after ${ELAPSED}s"
    exit 2
  fi

  S=$(status)
  log "stack=${S} elapsed=${ELAPSED}s"

  case "$S" in
    UPDATE_COMPLETE)
      log "SUCCESS — running post-deploy + capture"
      cd "$ROOT"
      ./scripts/cognito-recovery-post-deploy.sh dev 2>&1 | tee -a "$LOG"

      NEW_POOL_ID=$(aws cloudformation describe-stacks --stack-name "$STACK" --region "$REGION" \
        --query 'Stacks[0].Outputs[?OutputKey==`UserPoolId`].OutputValue' --output text)
      NEW_CLIENT_ID=$(aws cloudformation describe-stacks --stack-name "$STACK" --region "$REGION" \
        --query 'Stacks[0].Outputs[?OutputKey==`UserPoolClientId`].OutputValue' --output text)
      NEW_NATIVE_CLIENT_ID=$(aws cloudformation describe-stacks --stack-name "$STACK" --region "$REGION" \
        --query 'Stacks[0].Outputs[?OutputKey==`NativeUserPoolClientId`].OutputValue' --output text)
      NEW_API_URL=$(aws cloudformation describe-stacks --stack-name "$STACK" --region "$REGION" \
        --query 'Stacks[0].Outputs[?OutputKey==`HttpApiUrl`].OutputValue' --output text)
      NEW_CUSTOM_DOMAIN=$(aws cloudformation describe-stacks --stack-name "$STACK" --region "$REGION" \
        --query 'Stacks[0].Outputs[?OutputKey==`ApiCustomDomainUrl`].OutputValue' --output text)

      {
        echo ""
        echo "=== NEW COGNITO IDS (post UPDATE_COMPLETE) ==="
        echo "Pool ID:          ${NEW_POOL_ID}"
        echo "Web Client ID:    ${NEW_CLIENT_ID}"
        echo "Native Client ID: ${NEW_NATIVE_CLIENT_ID}"
        echo "API URL:          ${NEW_API_URL}"
        echo "Custom Domain:    ${NEW_CUSTOM_DOMAIN}"
        echo ""
      } | tee -a "$LOG"

      aws cognito-idp describe-user-pool --user-pool-id "$NEW_POOL_ID" --region "$REGION" \
        --query 'UserPool.[Id,Name,Status]' --output table 2>&1 | tee -a "$LOG"
      exit 0
      ;;
    UPDATE_ROLLBACK_IN_PROGRESS|UPDATE_ROLLBACK_FAILED|UPDATE_FAILED|ROLLBACK_FAILED)
      log "FAILURE terminal state: ${S}"
      aws cloudformation describe-stack-events --stack-name "$STACK" --region "$REGION" \
        --max-items 10 \
        --query 'StackEvents[?ResourceStatus==`CREATE_FAILED` || ResourceStatus==`UPDATE_FAILED`].[LogicalResourceId,ResourceStatusReason]' \
        --output table 2>&1 | tee -a "$LOG" || true
      exit 1
      ;;
  esac

  sleep "$POLL_SEC"
done
