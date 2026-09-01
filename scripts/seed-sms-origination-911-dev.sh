#!/usr/bin/env bash
# Patch test-agency outbound SMS origination (live/dev Dynamo).
#
# Agency-table fields are operator metadata. Outbound From is resolved from
# rapid-cortex-sms-routing-{stage} via resolveAgencySender(agencyId), so this
# script also upserts that routing row — otherwise sends stay on the shared pool.
#
# Usage:
#   AGENCIES_TABLE=rapid-cortex-agencies-dev \
#   AWS_REGION=us-east-1 \
#   bash scripts/seed-sms-origination-911-dev.sh
set -euo pipefail

REGION="${AWS_REGION:-us-east-1}"
STAGE="${DEPLOYMENT_STAGE:-dev}"
AGENCIES_TABLE="${AGENCIES_TABLE:-rapid-cortex-agencies-${STAGE}}"
SMS_ROUTING_TABLE="${SMS_ROUTING_TABLE:-rapid-cortex-sms-routing-${STAGE}}"
AGENCY_ID="${AGENCY_ID:-test-agency}"
AGENCY_NAME="${AGENCY_NAME:-Test Agency}"
NUMBER="${SMS_ORIGINATION_NUMBER:-+13198358230}"
PROVIDER="${SMS_PROVIDER:-aws}"
LABEL="${LABEL:-911 origination}"
CREATED_BY="${CREATED_BY:-ops-seed-sms-origination}"
NOW="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

if [[ ! "$NUMBER" =~ ^\+[1-9][0-9]{1,14}$ ]]; then
  echo "SMS_ORIGINATION_NUMBER must be E.164 (got: ${NUMBER})" >&2
  exit 1
fi

echo "Patching ${AGENCIES_TABLE} ${AGENCY_ID} smsOriginationNumber=${NUMBER} smsProvider=${PROVIDER}"

aws dynamodb update-item \
  --table-name "$AGENCIES_TABLE" \
  --region "$REGION" \
  --key "{\"agencyId\": {\"S\": \"${AGENCY_ID}\"}}" \
  --update-expression "SET smsOriginationNumber = :num, smsProvider = :prov, updatedAt = :now" \
  --expression-attribute-values "{
    \":num\": {\"S\": \"${NUMBER}\"},
    \":prov\": {\"S\": \"${PROVIDER}\"},
    \":now\": {\"S\": \"${NOW}\"}
  }" \
  --condition-expression "attribute_exists(agencyId)"

echo "Upserting ${SMS_ROUTING_TABLE} ${NUMBER} -> ${AGENCY_ID}"

aws dynamodb put-item \
  --table-name "$SMS_ROUTING_TABLE" \
  --region "$REGION" \
  --item "{
    \"phoneNumber\": {\"S\": \"${NUMBER}\"},
    \"agencyId\":    {\"S\": \"${AGENCY_ID}\"},
    \"vertical\":    {\"S\": \"911\"},
    \"agencyName\":  {\"S\": \"${AGENCY_NAME}\"},
    \"label\":       {\"S\": \"${LABEL}\"},
    \"active\":      {\"BOOL\": true},
    \"createdAt\":   {\"S\": \"${NOW}\"},
    \"createdBy\":   {\"S\": \"${CREATED_BY}\"},
    \"updatedAt\":   {\"S\": \"${NOW}\"}
  }"

echo ""
echo "Agency record:"
aws dynamodb get-item \
  --table-name "$AGENCIES_TABLE" \
  --region "$REGION" \
  --key "{\"agencyId\": {\"S\": \"${AGENCY_ID}\"}}" \
  --query "Item.{SMS:smsOriginationNumber.S,Provider:smsProvider.S}" \
  --output table

echo "Routing record:"
aws dynamodb get-item \
  --table-name "$SMS_ROUTING_TABLE" \
  --region "$REGION" \
  --key "{\"phoneNumber\": {\"S\": \"${NUMBER}\"}}" \
  --query "Item.{Phone:phoneNumber.S,Agency:agencyId.S,Active:active.BOOL,Vertical:vertical.S}" \
  --output table
