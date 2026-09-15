#!/usr/bin/env bash
set -euo pipefail
# Manually trigger the monthly billing run for testing.
# Usage: STAGE=dev ./scripts/trigger-billing-run.sh [YYYY-MM]
# Period is informational — the orchestrator uses America/New_York "now".

STAGE="${STAGE:-dev}"
PERIOD="${1:-$(date +%Y-%m)}"
FUNCTION="rc-billing-orchestrator-${STAGE}"

echo "Triggering billing run for period: ${PERIOD} on function: ${FUNCTION}"

aws lambda invoke \
  --function-name "${FUNCTION}" \
  --payload "{}" \
  --cli-binary-format raw-in-base64-out \
  /tmp/billing-run-response.json

cat /tmp/billing-run-response.json
echo ""
echo "Billing run triggered. Check CloudWatch logs and DynamoDB billing-runs table."
echo "Table: rapid-cortex-billing-runs-${STAGE}"
