#!/usr/bin/env bash
# Add vertical-createdAt-index GSI to the existing marketing-leads table.
# Table is managed via ExistingMarketingLeadsTableName (not recreated in CFN).
set -euo pipefail

STAGE="${1:-dev}"
PROFILE="${AWS_PROFILE:-rapid-cortex}"
REGION="${AWS_REGION:-us-east-1}"
TABLE="${MARKETING_LEADS_TABLE:-rapid-cortex-marketing-leads-${STAGE}}"
INDEX_NAME="vertical-createdAt-index"

ACCOUNT="$(aws sts get-caller-identity --profile "$PROFILE" --query Account --output text)"
if [[ "$ACCOUNT" != "158961537080" ]]; then
  echo "Refusing: expected account 158961537080, got $ACCOUNT" >&2
  exit 1
fi

echo "Ensuring GSI $INDEX_NAME on $TABLE ($PROFILE / $REGION)…"

EXISTING="$(aws dynamodb describe-table \
  --profile "$PROFILE" \
  --region "$REGION" \
  --table-name "$TABLE" \
  --query "Table.GlobalSecondaryIndexes[?IndexName=='${INDEX_NAME}'].IndexName" \
  --output text 2>/dev/null || true)"

if [[ "$EXISTING" == "$INDEX_NAME" ]]; then
  echo "GSI already present."
  exit 0
fi

aws dynamodb update-table \
  --profile "$PROFILE" \
  --region "$REGION" \
  --table-name "$TABLE" \
  --attribute-definitions \
    AttributeName=vertical,AttributeType=S \
    AttributeName=createdAt,AttributeType=S \
  --global-secondary-index-updates "[
    {
      \"Create\": {
        \"IndexName\": \"${INDEX_NAME}\",
        \"KeySchema\": [
          {\"AttributeName\": \"vertical\", \"KeyType\": \"HASH\"},
          {\"AttributeName\": \"createdAt\", \"KeyType\": \"RANGE\"}
        ],
        \"Projection\": {\"ProjectionType\": \"ALL\"}
      }
    }
  ]"

echo "GSI create submitted. Wait until IndexStatus=ACTIVE before querying."
echo "Then run: npx tsx scripts/backfill-marketing-leads-vertical.ts ${STAGE}"
