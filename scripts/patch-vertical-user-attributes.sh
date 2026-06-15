#!/usr/bin/env bash
# patch-vertical-user-attributes.sh
#
# Sets custom:role and custom:agencyId on all 12 vertical test users.
# Run from the Rapid Cortex repo root:
#
#   USER_POOL_ID=us-east-1_QgqAYyRwg \
#   REGION=us-east-1 \
#   bash scripts/patch-vertical-user-attributes.sh

set -euo pipefail

POOL="${USER_POOL_ID:?Set USER_POOL_ID}"
REGION="${REGION:-us-east-1}"

# Format: "email|custom:role|custom:agencyId"
USERS=(
  "campusadmin@appsondemand.net|campusadmin|test-campus-uga"
  "campussecurity@appsondemand.net|campussecurity|test-campus-uga"
  "campussupervisor@appsondemand.net|campussupervisor|test-campus-uga"
  "campusfaculty@appsondemand.net|campusfaculty|test-campus-uga"
  "campuscounselor@appsondemand.net|campuscounselor|test-campus-uga"
  "venue-admin@appsondemand.net|venue-admin|test-venue-mbs"
  "venue-security@appsondemand.net|venue-security|test-venue-mbs"
  "venue-supervisor@appsondemand.net|venue-supervisor|test-venue-mbs"
  "hospital-admin@appsondemand.net|hospital-admin|test-hospital"
  "hospital-staff@appsondemand.net|hospital-staff|test-hospital"
  "transit-admin@appsondemand.net|transit-admin|test-transit"
  "transit-security@appsondemand.net|transit-security|test-transit"
)

echo ""
echo "Patching ${#USERS[@]} users in pool: $POOL"
echo ""

for entry in "${USERS[@]}"; do
  IFS='|' read -r email role agency_id <<< "$entry"

  aws cognito-idp admin-update-user-attributes \
    --user-pool-id "$POOL" \
    --username "$email" \
    --region "$REGION" \
    --user-attributes \
      Name="custom:role",Value="$role" \
      Name="custom:agencyId",Value="$agency_id" \
      Name="custom:status",Value="active"

  echo "✓  $email  →  role=$role  agencyId=$agency_id"
done

echo ""
echo "Done. Verifying..."
echo ""

# Quick verification pass
for entry in "${USERS[@]}"; do
  IFS='|' read -r email role agency_id <<< "$entry"

  got_role=$(aws cognito-idp admin-get-user \
    --user-pool-id "$POOL" \
    --username "$email" \
    --region "$REGION" \
    --query "UserAttributes[?Name=='custom:role'].Value" \
    --output text 2>/dev/null || echo "ERROR")

  got_agency=$(aws cognito-idp admin-get-user \
    --user-pool-id "$POOL" \
    --username "$email" \
    --region "$REGION" \
    --query "UserAttributes[?Name=='custom:agencyId'].Value" \
    --output text 2>/dev/null || echo "ERROR")

  if [[ "$got_role" == "$role" && "$got_agency" == "$agency_id" ]]; then
    echo "✅  $email"
  else
    echo "❌  $email  got role=$got_role agencyId=$got_agency  (expected $role / $agency_id)"
  fi
done
