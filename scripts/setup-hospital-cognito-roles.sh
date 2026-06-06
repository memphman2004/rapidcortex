#!/usr/bin/env bash
# Create hospital Cognito groups and optional test users (hospitaladmin / hospitalstaff).
set -euo pipefail

POOL_ID="${COGNITO_USER_POOL_ID:-us-east-1_0z6tA6WBs}"
REGION="${AWS_REGION:-us-east-1}"
AGENCY_ID="${HOSPITAL_TEST_AGENCY_ID:-test-agency}"
HOSPITAL_ID="${HOSPITAL_TEST_HOSPITAL_ID:-demo-hospital-001}"
PASSWORD="${HOSPITAL_TEST_PASSWORD:-${RAPID_CORTEX_TEST_TEMP_PASSWORD:-RapidTest2026!}}"
PLAN_ID="${HOSPITAL_TEST_PLAN_ID:-essential}"
SUB_STATUS="${HOSPITAL_TEST_SUB_STATUS:-active}"

ensure_hospital_id_attribute() {
  if aws cognito-idp describe-user-pool \
    --user-pool-id "$POOL_ID" \
    --region "$REGION" \
    --query 'UserPool.SchemaAttributes[?Name==`custom:hospitalId`].Name' \
    --output text 2>/dev/null | grep -q hospitalId; then
    echo "✓ custom:hospitalId attribute present"
    return 0
  fi
  echo "Adding custom:hospitalId to user pool $POOL_ID …"
  aws cognito-idp add-custom-attributes \
    --user-pool-id "$POOL_ID" \
    --region "$REGION" \
    --custom-attributes 'Name=hospitalId,AttributeDataType=String,Mutable=true'
  echo "✅ Added custom:hospitalId"
}

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

ensure_group "hospitaladmin" "Hospital facility administrator"
ensure_group "hospitalstaff" "Hospital staff capacity updates"

create_hospital_user() {
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
        Name="custom:hospitalId",Value="$HOSPITAL_ID" \
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
        Name="custom:hospitalId",Value="$HOSPITAL_ID" \
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

if [[ "${CREATE_HOSPITAL_TEST_USERS:-0}" == "1" ]]; then
  create_hospital_user "hospitaladmin@appsondemand.net" "hospitaladmin"
  create_hospital_user "hospitalstaff@appsondemand.net" "hospitalstaff"
fi

echo ""
echo "Done. Groups: hospitaladmin, hospitalstaff (pool $POOL_ID)"
echo "Set CREATE_HOSPITAL_TEST_USERS=1 to provision test accounts."
