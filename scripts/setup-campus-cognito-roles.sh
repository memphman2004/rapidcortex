#!/usr/bin/env bash
# Create campus Cognito groups and optional QA users (CAMPUS_* roles).
# Campus Dynamo config (buildings/zones) is separate: apps/api/src/scripts/seed-campus-test-agency.ts
set -euo pipefail

POOL_ID="${COGNITO_USER_POOL_ID:-us-east-1_0z6tA6WBs}"
REGION="${AWS_REGION:-us-east-1}"
AGENCY_ID="${CAMPUS_TEST_AGENCY_ID:-test-campus-uga}"
PASSWORD="${CAMPUS_TEST_PASSWORD:-${RAPID_CORTEX_TEST_TEMP_PASSWORD:-RapidTest2026!}}"
PLAN_ID="${CAMPUS_TEST_PLAN_ID:-essential}"
SUB_STATUS="${CAMPUS_TEST_SUB_STATUS:-active}"

ensure_group() {
  local GROUP="$1"
  local DESC="$2"
  if aws cognito-idp get-group --user-pool-id "$POOL_ID" --group-name "$GROUP" --region "$REGION" &>/dev/null; then
    echo "✓ Group exists: $GROUP"
  else
    aws cognito-idp create-group \
      --user-pool-id "$POOL_ID" \
      --group-name "$GROUP" \
      --description "$DESC" \
      --region "$REGION"
    echo "✅ Created group: $GROUP"
  fi
}

ensure_group "CAMPUS_ADMIN" "Campus safety administrator"
ensure_group "CAMPUS_SUPERVISOR" "Campus shift supervisor"
ensure_group "CAMPUS_SECURITY" "Campus security officer"
ensure_group "CAMPUS_DISPATCH" "Campus dispatch / comms"
ensure_group "CAMPUS_COUNSELOR" "Campus counselor / wellness"
ensure_group "CAMPUS_FACULTY" "Campus faculty read-only"

create_campus_user() {
  local EMAIL="$1"
  local ROLE="$2"

  if aws cognito-idp admin-get-user --user-pool-id "$POOL_ID" --username "$EMAIL" --region "$REGION" &>/dev/null; then
    echo "⚠️  Updating $EMAIL → $ROLE"
    aws cognito-idp admin-update-user-attributes \
      --user-pool-id "$POOL_ID" \
      --username "$EMAIL" \
      --user-attributes \
        Name="custom:role",Value="$ROLE" \
        Name="custom:agencyId",Value="$AGENCY_ID" \
        Name="custom:status",Value=active \
        Name="custom:planId",Value="$PLAN_ID" \
        Name="custom:subStatus",Value="$SUB_STATUS" \
      --region "$REGION"
  else
    aws cognito-idp admin-create-user \
      --user-pool-id "$POOL_ID" \
      --username "$EMAIL" \
      --user-attributes \
        Name=email,Value="$EMAIL" \
        Name=email_verified,Value=true \
        Name="custom:role",Value="$ROLE" \
        Name="custom:agencyId",Value="$AGENCY_ID" \
        Name="custom:status",Value=active \
        Name="custom:planId",Value="$PLAN_ID" \
        Name="custom:subStatus",Value="$SUB_STATUS" \
      --message-action SUPPRESS \
      --region "$REGION"
    echo "✅ Created $EMAIL"
  fi

  aws cognito-idp admin-set-user-password \
    --user-pool-id "$POOL_ID" \
    --username "$EMAIL" \
    --password "$PASSWORD" \
    --permanent \
    --region "$REGION"

  aws cognito-idp admin-add-user-to-group \
    --user-pool-id "$POOL_ID" \
    --username "$EMAIL" \
    --group-name "$ROLE" \
    --region "$REGION" 2>/dev/null || true
}

if [[ "${CREATE_CAMPUS_TEST_USERS:-0}" == "1" ]]; then
  create_campus_user "campusadmin@appsondemand.net" "CAMPUS_ADMIN"
  create_campus_user "campussupervisor@appsondemand.net" "CAMPUS_SUPERVISOR"
  create_campus_user "campussecurity@appsondemand.net" "CAMPUS_SECURITY"
  create_campus_user "campusdispatch@appsondemand.net" "CAMPUS_DISPATCH"
  create_campus_user "campuscounselor@appsondemand.net" "CAMPUS_COUNSELOR"
  create_campus_user "campusfaculty@appsondemand.net" "CAMPUS_FACULTY"
fi

echo ""
echo "Done. Campus groups provisioned in pool $POOL_ID (agencyId=$AGENCY_ID → campus code UGA)."
echo "Set CREATE_CAMPUS_TEST_USERS=1 to provision test accounts."
echo "Seed campus buildings/zones: CAMPUS_CONFIG_TABLE=... npx tsx apps/api/src/scripts/seed-campus-test-agency.ts UGA"
