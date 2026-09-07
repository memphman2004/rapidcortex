#!/usr/bin/env bash
# scripts/add-vertical-attributes.sh
#
# Adds custom:vertical to all 12 vertical test users.
# The post-login redirect handler reads this to build the workspace URL
# without requiring a DynamoDB agency lookup at auth time.
#
# Run:
#   USER_POOL_ID=us-east-1_0z6tA6WBs \
#   REGION=us-east-1 \
#   bash scripts/add-vertical-attributes.sh

set -euo pipefail

POOL="${USER_POOL_ID:?Set USER_POOL_ID}"
REGION="${REGION:-us-east-1}"

# Format: "email|custom:vertical"
USERS=(
  "campusadmin@appsondemand.net|campus"
  "campussecurity@appsondemand.net|campus"
  "campussupervisor@appsondemand.net|campus"
  "campusfaculty@appsondemand.net|campus"
  "campuscounselor@appsondemand.net|campus"
  "venue-admin@appsondemand.net|venue"
  "venue-security@appsondemand.net|venue"
  "venue-supervisor@appsondemand.net|venue"
  "hospital-admin@appsondemand.net|hospital"
  "hospital-staff@appsondemand.net|hospital"
  "transit-admin@appsondemand.net|transit"
  "transit-supervisor@appsondemand.net|transit"
  "transit-security@appsondemand.net|transit"
  "transit-operator@appsondemand.net|transit"
)

echo ""
echo "Adding custom:vertical to ${#USERS[@]} users in pool: $POOL"
echo ""

for entry in "${USERS[@]}"; do
  IFS='|' read -r email vertical <<< "$entry"

  aws cognito-idp admin-update-user-attributes \
    --user-pool-id "$POOL" \
    --username "$email" \
    --region "$REGION" \
    --user-attributes \
      Name="custom:vertical",Value="$vertical"

  echo "✓  $email  →  vertical=$vertical"
done

echo ""
echo "Verifying..."
echo ""

for entry in "${USERS[@]}"; do
  IFS='|' read -r email vertical <<< "$entry"

  got=$(aws cognito-idp admin-get-user \
    --user-pool-id "$POOL" \
    --username "$email" \
    --region "$REGION" \
    --query "UserAttributes[?Name=='custom:vertical'].Value" \
    --output text 2>/dev/null || echo "ERROR")

  if [[ "$got" == "$vertical" ]]; then
    echo "✅  $email  →  vertical=$got"
  else
    echo "❌  $email  got=$got  expected=$vertical"
  fi
done
