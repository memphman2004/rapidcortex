#!/usr/bin/env bash
# Opt-in: enable DynamoDB TTL on the Call Assist table.
# NOT run by deploy.sh — imported live tables may have TTL disabled; enabling
# starts expiry for rows with expiresAt and must be an explicit ops decision.
set -euo pipefail

STAGE="${1:-dev}"
TABLE="rapid-cortex-call-assist-${STAGE}"
PROFILE="${AWS_PROFILE:-rapid-cortex}"
REGION="${AWS_REGION:-us-east-1}"

echo "About to enable TTL attribute expiresAt on ${TABLE} (profile=${PROFILE})."
echo "This can delete aged session rows. Ctrl-C within 5s to abort."
sleep 5

aws dynamodb update-time-to-live \
  --profile "$PROFILE" \
  --region "$REGION" \
  --table-name "$TABLE" \
  --time-to-live-specification "Enabled=true,AttributeName=expiresAt"

aws dynamodb describe-time-to-live --profile "$PROFILE" --region "$REGION" --table-name "$TABLE"
echo "Done. See docs/call-assist/ADR-001-live-architecture-acceptance.md"
