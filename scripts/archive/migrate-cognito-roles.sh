#!/usr/bin/env bash
# Migrate dev Cognito test users to canonical RapidCortexRole values (packages/shared).
# Usage: ./scripts/migrate-cognito-roles.sh
set -euo pipefail

POOL_ID="${COGNITO_USER_POOL_ID:-us-east-1_0z6tA6WBs}"
REGION="${AWS_REGION:-us-east-1}"
PASSWORD="${RC_TEST_PASSWORD:-RapidTest2026!}"
NOW=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

update_role() {
  local email="$1"
  local role="$2"
  aws cognito-idp admin-update-user-attributes \
    --user-pool-id "$POOL_ID" \
    --username "$email" \
    --user-attributes Name=custom:role,Value="$role" \
    --region "$REGION"
  echo "✅ ${email} → ${role}"
}

update_platform_role() {
  local email="$1"
  local role="$2"
  aws cognito-idp admin-update-user-attributes \
    --user-pool-id "$POOL_ID" \
    --username "$email" \
    --user-attributes \
      Name=custom:role,Value="$role" \
      Name=custom:agencyId,Value=__platform__ \
      Name=custom:planId,Value=command \
    --region "$REGION"
  echo "✅ ${email} → ${role} (__platform__)"
}

echo "Renaming Cognito custom:role values to canonical naming (see packages/shared/src/auth/rapid-cortex-roles.ts)..."
echo "Pool: ${POOL_ID}  Region: ${REGION}"
echo ""

# ── Platform accounts ─────────────────────────────────────────────────────────
update_platform_role "rcadmin@appsondemand.net" "rcsuperadmin"

if aws cognito-idp admin-create-user \
  --user-pool-id "$POOL_ID" \
  --username "rcstaff@appsondemand.net" \
  --user-attributes \
    Name=email,Value="rcstaff@appsondemand.net" \
    Name=email_verified,Value=true \
    Name="custom:role",Value="rcadmin" \
    Name="custom:agencyId",Value="__platform__" \
    Name="custom:planId",Value="command" \
    Name="custom:pwdChangedAt",Value="$NOW" \
  --message-action SUPPRESS \
  --region "$REGION" 2>/dev/null; then
  echo "✅ Created rcstaff@appsondemand.net → rcadmin"
else
  update_platform_role "rcstaff@appsondemand.net" "rcadmin"
fi

aws cognito-idp admin-set-user-password \
  --user-pool-id "$POOL_ID" \
  --username "rcstaff@appsondemand.net" \
  --password "$PASSWORD" \
  --permanent \
  --region "$REGION" 2>/dev/null || true
echo "✅ Password set for rcstaff (if user exists)"

if aws cognito-idp admin-create-user \
  --user-pool-id "$POOL_ID" \
  --username "rcit@appsondemand.net" \
  --user-attributes \
    Name=email,Value="rcit@appsondemand.net" \
    Name=email_verified,Value=true \
    Name="custom:role",Value="rcitadmin" \
    Name="custom:agencyId",Value="__platform__" \
    Name="custom:planId",Value="command" \
    Name="custom:pwdChangedAt",Value="$NOW" \
  --message-action SUPPRESS \
  --region "$REGION" 2>/dev/null; then
  echo "✅ Created rcit@appsondemand.net → rcitadmin"
else
  update_platform_role "rcit@appsondemand.net" "rcitadmin"
fi

aws cognito-idp admin-set-user-password \
  --user-pool-id "$POOL_ID" \
  --username "rcit@appsondemand.net" \
  --password "$PASSWORD" \
  --permanent \
  --region "$REGION" 2>/dev/null || true

echo "Password set for rcit (if user exists)"

# ── Agency accounts (customer-facing roles) ───────────────────────────────────
update_role "admin@appsondemand.net" "agencyadmin"
update_role "itadmin@appsondemand.net" "agencyit"
# Canonical role name per Role Access Matrix v2.0
update_role "supervisor@appsondemand.net" "supervisor"
update_role "dispatcher@appsondemand.net" "dispatcher"
update_role "analyst@appsondemand.net" "analyst"
update_role "auditor@appsondemand.net" "auditor"

if aws cognito-idp admin-disable-user \
  --user-pool-id "$POOL_ID" \
  --username "staff@appsondemand.net" \
  --region "$REGION" 2>/dev/null; then
  echo "✅ staff@appsondemand.net → disabled (role dropped)"
else
  echo "⚠️  staff@appsondemand.net not found or already disabled"
fi

echo ""
echo "Verifying accounts (email + custom:role)..."
aws cognito-idp list-users \
  --user-pool-id "$POOL_ID" \
  --query 'Users[*].{Email:Attributes[?Name==`email`].Value|[0],Role:Attributes[?Name==`custom:role`].Value|[0],Enabled:Enabled}' \
  --output table \
  --region "$REGION"

echo ""
echo "Platform: rcsuperadmin (owner), rcadmin (ops), rcitadmin (IT)"
echo "Agency: agencyadmin, agencyit, commsupervisor, dispatcher, analyst, auditor"
