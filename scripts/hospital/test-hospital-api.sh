#!/usr/bin/env bash
set -euo pipefail

ENVIRONMENT="${1:?Usage: $0 <env>}"
REGION="${AWS_REGION:-us-east-1}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=scripts/hospital/sam-tables.sh
source "${SCRIPT_DIR}/sam-tables.sh"
resolve_hospital_tables "${ENVIRONMENT}"

AGENCY_ID="${HOSPITAL_AGENCY_ID}"
PK="AGENCY#${AGENCY_ID}"

echo "🧪 Testing Hospital Module (SAM tables)"
echo "   Profiles: ${HOSPITAL_PROFILES_TABLE}"
echo "   Capacity: ${HOSPITAL_CAPACITY_TABLE}"
echo "   Agency:   ${AGENCY_ID}"

echo ""
echo "Test 1: Verify DynamoDB tables exist"
for TABLE in "${HOSPITAL_PROFILES_TABLE}" "${HOSPITAL_CAPACITY_TABLE}"; do
  if aws dynamodb describe-table --table-name "${TABLE}" --region "${REGION}" >/dev/null 2>&1; then
    echo "  ✅ ${TABLE}"
  else
    echo "  ❌ Table not found: ${TABLE}"
    exit 1
  fi
done

echo ""
echo "Test 2: Query hospital profiles by agency"
RESULT="$(
  aws dynamodb query \
    --table-name "${HOSPITAL_PROFILES_TABLE}" \
    --key-condition-expression "pk = :pk AND begins_with(sk, :prefix)" \
    --expression-attribute-values "{\":pk\":{\"S\":\"${PK}\"},\":prefix\":{\"S\":\"HOSPITAL#\"}}" \
    --region "${REGION}" \
    --output json
)"

COUNT="$(echo "$RESULT" | jq '.Items | length')"
if [[ "$COUNT" -ge 3 ]]; then
  echo "  ✅ Found ${COUNT} hospital profiles"
else
  echo "  ❌ Expected at least 3 profiles, found ${COUNT}"
  exit 1
fi

echo ""
echo "Test 3: Get hospital profile by key"
RESULT="$(
  aws dynamodb get-item \
    --table-name "${HOSPITAL_PROFILES_TABLE}" \
    --key "{\"pk\":{\"S\":\"${PK}\"},\"sk\":{\"S\":\"HOSPITAL#HOSP-001\"}}" \
    --region "${REGION}" \
    --output json
)"

HOSPITAL_NAME="$(echo "$RESULT" | jq -r '.Item.name.S')"
if [[ -n "$HOSPITAL_NAME" && "$HOSPITAL_NAME" != "null" ]]; then
  echo "  ✅ Retrieved profile: ${HOSPITAL_NAME}"
else
  echo "  ❌ Failed to get hospital profile"
  exit 1
fi

echo ""
echo "Test 4: Query latest capacity snapshot"
RESULT="$(
  aws dynamodb query \
    --table-name "${HOSPITAL_CAPACITY_TABLE}" \
    --key-condition-expression "pk = :pk AND begins_with(sk, :prefix)" \
    --expression-attribute-values "{\":pk\":{\"S\":\"${PK}\"},\":prefix\":{\"S\":\"CAPACITY#HOSP-001#\"}}" \
    --no-scan-index-forward \
    --limit 1 \
    --region "${REGION}" \
    --output json
)"

ER_AVAILABLE="$(echo "$RESULT" | jq -r '.Items[0].availability.M.erBeds.M.available.N // empty')"
if [[ -n "$ER_AVAILABLE" ]]; then
  echo "  ✅ Latest capacity for HOSP-001 (ER beds available: ${ER_AVAILABLE})"
else
  echo "  ❌ No capacity snapshot found for HOSP-001"
  exit 1
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ All tests passed!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
