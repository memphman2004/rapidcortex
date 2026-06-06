#!/usr/bin/env bash
set -euo pipefail

POOL_ID="${COGNITO_USER_POOL_ID:-us-east-1_0z6tA6WBs}"
REGION="${AWS_REGION:-us-east-1}"
AGENCY_ID="test-agency"
PASSWORD="RapidTest2026!"
PLAN_ID="essential"
SUB_STATUS="active"

echo "Adding missing role test users to pool: $POOL_ID"

create_or_update_user() {
  local EMAIL="$1"
  local ROLE="$2"
  local AGENCY="$3"

  # Try create first
  if aws cognito-idp admin-create-user \
    --user-pool-id "$POOL_ID" \
    --username "$EMAIL" \
    --user-attributes \
      Name=email,Value="$EMAIL" \
      Name=email_verified,Value=true \
      Name="custom:role",Value="$ROLE" \
      Name="custom:agencyId",Value="$AGENCY" \
      Name="custom:status",Value=active \
      Name="custom:planId",Value="$PLAN_ID" \
      Name="custom:subStatus",Value="$SUB_STATUS" \
    --message-action SUPPRESS \
    --region "$REGION" 2>/dev/null; then
    echo "✅ Created $EMAIL ($ROLE)"
  else
    echo "⚠️  User exists, updating attributes for $EMAIL ($ROLE)"
    aws cognito-idp admin-update-user-attributes \
      --user-pool-id "$POOL_ID" \
      --username "$EMAIL" \
      --user-attributes \
        Name="custom:role",Value="$ROLE" \
        Name="custom:agencyId",Value="$AGENCY" \
        Name="custom:status",Value=active \
        Name="custom:planId",Value="$PLAN_ID" \
        Name="custom:subStatus",Value="$SUB_STATUS" \
      --region "$REGION"
    echo "✅ Updated $EMAIL ($ROLE)"
  fi

  # Set permanent password
  aws cognito-idp admin-set-user-password \
    --user-pool-id "$POOL_ID" \
    --username "$EMAIL" \
    --password "$PASSWORD" \
    --permanent \
    --region "$REGION"

  echo "   Password set: $PASSWORD"
}

# Missing users
create_or_update_user "itadmin@appsondemand.net"  "agencyit"  "$AGENCY_ID"
create_or_update_user "analyst@appsondemand.net"  "analyst"   "$AGENCY_ID"
create_or_update_user "auditor@appsondemand.net"  "auditor"   "$AGENCY_ID"

echo ""
echo "Done. Verify all users:"
aws cognito-idp list-users \
  --user-pool-id "$POOL_ID" \
  --query 'Users[*].{Email:Attributes[?Name==`email`].Value|[0], Role:Attributes[?Name==`custom:role`].Value|[0], AgencyId:Attributes[?Name==`custom:agencyId`].Value|[0], Status:UserStatus}' \
  --output table \
  --region "$REGION"
