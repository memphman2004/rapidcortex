#!/usr/bin/env bash
# Add Call Assist table GSI2 (caller lookup) when the table already exists
# and was not created by the nested stack (ExistingCallAssistTableName).
#
# Usage:
#   AWS_PROFILE=rapid-cortex bash scripts/ensure-call-assist-gsi2.sh [table-name]
set -euo pipefail
TABLE="${1:-rapid-cortex-call-assist-dev}"
REGION="${AWS_REGION:-us-east-1}"

has_gsi2="$(aws dynamodb describe-table --table-name "${TABLE}" --region "${REGION}" \
  --query "Table.GlobalSecondaryIndexes[?IndexName=='gsi2'].IndexName | [0]" --output text 2>/dev/null || true)"

if [[ "${has_gsi2}" == "gsi2" ]]; then
  echo "GSI2 already present on ${TABLE}"
  exit 0
fi

echo "Adding GSI2 to ${TABLE}…"
aws dynamodb update-table \
  --table-name "${TABLE}" \
  --region "${REGION}" \
  --attribute-definitions \
    AttributeName=gsi2pk,AttributeType=S \
    AttributeName=gsi2sk,AttributeType=S \
  --global-secondary-index-updates '[{
    "Create": {
      "IndexName": "gsi2",
      "KeySchema": [
        {"AttributeName": "gsi2pk", "KeyType": "HASH"},
        {"AttributeName": "gsi2sk", "KeyType": "RANGE"}
      ],
      "Projection": {"ProjectionType": "ALL"}
    }
  }]'

echo "GSI2 create submitted — wait until IndexStatus=ACTIVE before relying on caller lookups."
