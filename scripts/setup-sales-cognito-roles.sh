#!/usr/bin/env bash
set -euo pipefail
export AWS_PROFILE="${AWS_PROFILE:-rapid-cortex}"
USER_POOL_ID="${USER_POOL_ID:?USER_POOL_ID not set}"
aws cognito-idp create-group \
  --user-pool-id "$USER_POOL_ID" \
  --group-name "salescontractor" \
  --description "NexCort iQ commission sales contractors — sales portal only" \
  --profile "$AWS_PROFILE" --region us-east-1 \
  || echo "Group may already exist"
