#!/usr/bin/env bash
# Seed SMS routing record for test-campus-uga after stack 5 deploy.
# Usage: TWILIO_NUMBER=+17065551234 bash scripts/seed-sms-routing-dev.sh
set -euo pipefail

STAGE="${DEPLOYMENT_STAGE:-dev}"
REGION="${AWS_REGION:-us-east-1}"
TABLE="${SMS_ROUTING_TABLE:-rapid-cortex-sms-routing-${STAGE}}"
PHONE="${TWILIO_NUMBER:?Set TWILIO_NUMBER in E.164 format, e.g. +17065551234}"
AGENCY_ID="${AGENCY_ID:-test-campus-uga}"
AGENCY_NAME="${AGENCY_NAME:-Test Campus UGA}"
LABEL="${LABEL:-Main reporting line}"
CREATED_BY="${CREATED_BY:-ops-seed}"
NOW="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

aws dynamodb put-item \
  --table-name "$TABLE" \
  --item "{
    \"phoneNumber\": {\"S\": \"${PHONE}\"},
    \"agencyId\":    {\"S\": \"${AGENCY_ID}\"},
    \"vertical\":    {\"S\": \"campus\"},
    \"agencyName\":  {\"S\": \"${AGENCY_NAME}\"},
    \"label\":       {\"S\": \"${LABEL}\"},
    \"active\":      {\"BOOL\": true},
    \"createdAt\":   {\"S\": \"${NOW}\"},
    \"createdBy\":   {\"S\": \"${CREATED_BY}\"}
  }" \
  --region "$REGION"

echo "Seeded SMS routing: ${PHONE} -> ${AGENCY_ID} (${TABLE})"
