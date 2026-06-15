#!/usr/bin/env bash
# scripts/seed-billing-customers.sh
#
# Minimal billing customer rows for bulk-draft invoice generation.
# Table PK: customerId. Rows are scoped by agencyId (required for invoice creation).
#
# Run:
#   REGION=us-east-1 STAGE=dev bash scripts/seed-billing-customers.sh

set -euo pipefail

REGION="${REGION:-us-east-1}"
STAGE="${STAGE:-dev}"
TABLE="rapid-cortex-customers-${STAGE}"
NOW=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

put_customer() {
  local agency_id="$1"
  local agency_name="$2"
  local email="$3"
  local customer_id="cus-${agency_id}"

  aws dynamodb put-item \
    --region "$REGION" \
    --table-name "$TABLE" \
    --item "{
      \"customerId\": {\"S\": \"${customer_id}\"},
      \"agencyId\": {\"S\": \"${agency_id}\"},
      \"agencyName\": {\"S\": \"${agency_name}\"},
      \"billingContact\": {\"S\": \"${agency_name} Billing\"},
      \"email\": {\"S\": \"${email}\"},
      \"paymentTerms\": {\"S\": \"NET_30\"},
      \"requiresPO\": {\"BOOL\": false},
      \"taxExempt\": {\"BOOL\": true},
      \"isDeleted\": {\"BOOL\": false},
      \"createdAt\": {\"S\": \"${NOW}\"},
      \"updatedAt\": {\"S\": \"${NOW}\"}
    }" \
    --condition-expression "attribute_not_exists(customerId)" 2>/dev/null \
    && echo "✓  Created billing customer ${customer_id} (${agency_id})" \
    || echo "↻  Exists   ${customer_id} (${agency_id})"
}

echo "Seeding billing customers → ${TABLE} (${REGION})"
echo ""

put_customer "test-campus-uga" "Test Campus — UGA" "campus-admin@appsondemand.net"
put_customer "test-venue-mbs" "Test Venue — MBS" "venue-admin@appsondemand.net"
put_customer "test-hospital" "Test Hospital" "hospital-admin@appsondemand.net"
put_customer "test-transit" "Test Transit" "transit-admin@appsondemand.net"

echo ""
echo "Done. Verify:"
echo "  aws dynamodb scan --table-name ${TABLE} --region ${REGION} --projection-expression customerId,agencyId,email"
