#!/usr/bin/env bash
# Seed an inbound/outbound SMS routing row after stack 5 deploy.
#
# End User Messaging in us-east-1 is PRODUCTION (sandbox lifted 2026-09-14).
# SMS_NUMBER must be a real origination identity already in AWS (10DLC / TFN).
# The live Rapid Cortex 10DLC is +13198358230 (assigned to test-agency). Do not
# point a second agency at that number — SendTextMessage would impersonate it.
#
# Placeholder numbers (e.g. +17065551234) are not origination identities; AWS
# will accept the Dynamo row and then fail live sends with ResourceNotFoundException.
#
# Usage:
#   SMS_NUMBER=+13198358230 AGENCY_ID=test-agency bash scripts/seed-sms-routing-dev.sh
set -euo pipefail

STAGE="${DEPLOYMENT_STAGE:-dev}"
REGION="${AWS_REGION:-us-east-1}"
TABLE="${SMS_ROUTING_TABLE:-rapid-cortex-sms-routing-${STAGE}}"
PHONE="${SMS_NUMBER:?Set SMS_NUMBER in E.164 format, e.g. +13198358230}"
AGENCY_ID="${AGENCY_ID:-test-campus-uga}"
AGENCY_NAME="${AGENCY_NAME:-Test Campus UGA}"
LABEL="${LABEL:-Main reporting line}"
CREATED_BY="${CREATED_BY:-ops-seed}"
ALLOW_UNREGISTERED="${ALLOW_UNREGISTERED_SMS_NUMBER:-0}"
NOW="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

if [[ ! "$PHONE" =~ ^\+[1-9][0-9]{1,14}$ ]]; then
  echo "SMS_NUMBER must be E.164 (got: ${PHONE})" >&2
  exit 1
fi

if [[ "$ALLOW_UNREGISTERED" != "1" ]]; then
  if ! aws pinpoint-sms-voice-v2 describe-phone-numbers --region "$REGION" --output json \
    | python3 -c "import json,sys
want=sys.argv[1]
nums=json.load(sys.stdin).get('PhoneNumbers') or []
sys.exit(0 if any(n.get('PhoneNumber')==want and n.get('Status')=='ACTIVE' for n in nums) else 1)
" "$PHONE"; then
    echo "FAIL: ${PHONE} is not an ACTIVE End User Messaging origination number in ${REGION}." >&2
    echo "Live 10DLC (as of 2026-09-14): +13198358230. Request/port a number, or re-run with ALLOW_UNREGISTERED_SMS_NUMBER=1 for a Dynamo-only stub." >&2
    exit 1
  fi
  echo "PASS: ${PHONE} is an ACTIVE origination number"
fi

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
