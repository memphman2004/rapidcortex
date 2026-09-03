#!/usr/bin/env bash
# Create transit Cognito groups (TRANSIT_ADMIN / SUPERVISOR / SECURITY / OPERATOR).
set -euo pipefail

POOL_ID="${COGNITO_USER_POOL_ID:-us-east-1_0z6tA6WBs}"
REGION="${AWS_REGION:-us-east-1}"
AGENCY_ID="${TRANSIT_TEST_AGENCY_ID:-test-transit-hvt}"
PASSWORD="${TRANSIT_TEST_PASSWORD:-${RAPID_CORTEX_TEST_TEMP_PASSWORD:-RapidTest2026!}}"
PLAN_ID="${TRANSIT_TEST_PLAN_ID:-essential}"
SUB_STATUS="${TRANSIT_TEST_SUB_STATUS:-active}"

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

ensure_group "TRANSIT_ADMIN" "Transit authority administrator"
ensure_group "TRANSIT_SUPERVISOR" "Transit operations supervisor"
ensure_group "TRANSIT_SECURITY" "Transit security / dispatch ops"
ensure_group "TRANSIT_OPERATOR" "Transit vehicle operator"

create_transit_user() {
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
      --temporary-password "$PASSWORD" \
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
    echo "✅ Created $EMAIL ($ROLE)"
  fi
  aws cognito-idp admin-add-user-to-group \
    --user-pool-id "$POOL_ID" \
    --username "$EMAIL" \
    --group-name "$ROLE" \
    --region "$REGION" >/dev/null
}

if [[ "${CREATE_TRANSIT_QA_USERS:-0}" == "1" ]]; then
  create_transit_user "transit-admin@rapidcortex.us" "TRANSIT_ADMIN"
  create_transit_user "transit-supervisor@rapidcortex.us" "TRANSIT_SUPERVISOR"
  create_transit_user "transit-security@rapidcortex.us" "TRANSIT_SECURITY"
  create_transit_user "transit-operator@rapidcortex.us" "TRANSIT_OPERATOR"
fi
