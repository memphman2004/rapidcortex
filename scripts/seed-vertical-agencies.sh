#!/usr/bin/env bash
# scripts/seed-vertical-agencies.sh
#
# Creates the 4 test agency records in DynamoDB needed for the vertical dashboards.
# Each record includes the vertical field so /api/agencies/{id} returns it.
#
# Run:
#   REGION=us-east-1 \
#   STAGE=dev \
#   bash scripts/seed-vertical-agencies.sh

set -euo pipefail

REGION="${REGION:-us-east-1}"
STAGE="${STAGE:-dev}"
TABLE="rapid-cortex-agencies-${STAGE}"
NOW=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

put_agency() {
  local agency_id="$1"
  local name="$2"
  local vertical="$3"
  local type="$4"
  local state="$5"

  aws dynamodb put-item \
    --region "$REGION" \
    --table-name "$TABLE" \
    --condition-expression "attribute_not_exists(agencyId)" \
    --item "{
      \"agencyId\":        {\"S\": \"${agency_id}\"},
      \"name\":            {\"S\": \"${name}\"},
      \"vertical\":        {\"S\": \"${vertical}\"},
      \"type\":            {\"S\": \"${type}\"},
      \"state\":           {\"S\": \"${state}\"},
      \"status\":          {\"S\": \"active\"},
      \"plan\":            {\"S\": \"pilot\"},
      \"integrationMode\": {\"S\": \"demo_only\"},
      \"primaryContactEmail\": {\"S\": \"${vertical}-admin@appsondemand.net\"},
      \"createdAt\":       {\"S\": \"${NOW}\"},
      \"updatedAt\":       {\"S\": \"${NOW}\"}
    }" 2>/dev/null \
  && echo "✓  Created  ${agency_id}  (${vertical})" \
  || echo "↻  Exists   ${agency_id}  — patching vertical field"

  aws dynamodb update-item \
    --region "$REGION" \
    --table-name "$TABLE" \
    --key "{\"agencyId\": {\"S\": \"${agency_id}\"}}" \
    --update-expression "SET vertical = :v, #nm = :n, #st = :s, updatedAt = :now" \
    --expression-attribute-names '{"#nm":"name","#st":"status"}' \
    --expression-attribute-values "{
      \":v\":   {\"S\": \"${vertical}\"},
      \":n\":   {\"S\": \"${name}\"},
      \":s\":   {\"S\": \"active\"},
      \":now\": {\"S\": \"${NOW}\"}
    }" > /dev/null
}

echo ""
echo "Seeding 4 vertical agencies into: $TABLE"
echo ""

put_agency "test-campus-uga"  "UGA Campus Safety"           "campus"   "municipality" "GA"
put_agency "test-venue-mbs"   "Mercedes-Benz Stadium"       "venue"    "municipality" "GA"
put_agency "test-hospital"    "RC Test Hospital"             "hospital" "municipality" "GA"
put_agency "test-transit"     "RC Test Transit Authority"    "transit"  "municipality" "GA"

echo ""
echo "Verifying vertical field on each record..."
echo ""

for id in test-campus-uga test-venue-mbs test-hospital test-transit; do
  vertical=$(aws dynamodb get-item \
    --region "$REGION" \
    --table-name "$TABLE" \
    --key "{\"agencyId\": {\"S\": \"${id}\"}}" \
    --query "Item.vertical.S" \
    --output text 2>/dev/null || echo "MISSING")

  name=$(aws dynamodb get-item \
    --region "$REGION" \
    --table-name "$TABLE" \
    --key "{\"agencyId\": {\"S\": \"${id}\"}}" \
    --query "Item.name.S" \
    --output text 2>/dev/null || echo "MISSING")

  if [[ "$vertical" != "MISSING" && "$vertical" != "None" ]]; then
    echo "✅  $id  →  vertical=$vertical  name=$name"
  else
    echo "❌  $id  vertical not set"
  fi
done

echo ""
echo "Done."
