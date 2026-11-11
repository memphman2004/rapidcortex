#!/usr/bin/env bash
# ADD-only: field-responder Cognito group, custom:responder_role schema attr,
# and four test-agency logins (officer / firefighter / ems / unit_commander).
# Does not modify existing dispatch groups, MFA, or password policy.
set -euo pipefail

POOL_ID="${COGNITO_USER_POOL_ID:-us-east-1_0z6tA6WBs}"
REGION="${AWS_REGION:-us-east-1}"
export AWS_PROFILE="${AWS_PROFILE:-rapid-cortex}"
export AWS_REGION="$REGION"
export AWS_DEFAULT_REGION="$REGION"

AGENCY_ID="${FIELD_RESPONDER_TEST_AGENCY_ID:-test-agency}"
PASSWORD="${FIELD_RESPONDER_TEST_PASSWORD:-${RAPID_CORTEX_TEST_TEMP_PASSWORD:-RapidCore2027!}}"
PLAN_ID="${FIELD_RESPONDER_TEST_PLAN_ID:-command}"
SUB_STATUS="${FIELD_RESPONDER_TEST_SUB_STATUS:-active}"
GROUP_NAME="field-responder"

ACCOUNT="$(aws sts get-caller-identity --query Account --output text)"
if [[ "$ACCOUNT" != "158961537080" ]]; then
  echo "Refusing Cognito change: expected account 158961537080, got $ACCOUNT" >&2
  exit 1
fi

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

# Cognito AddCustomAttributes uses the bare name; pool stores custom:responder_role.
ensure_responder_role_attribute() {
  local HAS
  HAS="$(aws cognito-idp describe-user-pool \
    --user-pool-id "$POOL_ID" \
    --region "$REGION" \
    --query "UserPool.SchemaAttributes[?Name=='custom:responder_role'].Name | [0]" \
    --output text 2>/dev/null || true)"
  if [[ "$HAS" == "custom:responder_role" ]]; then
    echo "✓ Schema attribute exists: custom:responder_role"
    return 0
  fi
  echo "▶ Adding custom:responder_role to user pool schema (immutable ADD)"
  aws cognito-idp add-custom-attributes \
    --user-pool-id "$POOL_ID" \
    --region "$REGION" \
    --custom-attributes \
      Name=responder_role,AttributeDataType=String,Mutable=true,StringAttributeConstraints="{MinLength=1,MaxLength=64}"
  echo "✅ Added custom:responder_role"
}

provision_user() {
  local EMAIL="$1"
  local RESPONDER_ROLE="$2"

  local ATTRS=(
    Name=email,Value="$EMAIL"
    Name=email_verified,Value=true
    Name="custom:role",Value="field_responder"
    Name="custom:agencyId",Value="$AGENCY_ID"
    Name="custom:status",Value=active
    Name="custom:planId",Value="$PLAN_ID"
    Name="custom:subStatus",Value="$SUB_STATUS"
    Name="custom:responder_role",Value="$RESPONDER_ROLE"
  )

  if aws cognito-idp admin-get-user --user-pool-id "$POOL_ID" --username "$EMAIL" --region "$REGION" &>/dev/null; then
    echo "Updating $EMAIL → field_responder / $RESPONDER_ROLE ($AGENCY_ID)"
    aws cognito-idp admin-update-user-attributes \
      --user-pool-id "$POOL_ID" \
      --username "$EMAIL" \
      --user-attributes "${ATTRS[@]}" \
      --region "$REGION"
  else
    aws cognito-idp admin-create-user \
      --user-pool-id "$POOL_ID" \
      --username "$EMAIL" \
      --temporary-password "$PASSWORD" \
      --user-attributes "${ATTRS[@]}" \
      --message-action SUPPRESS \
      --region "$REGION"
    echo "Created $EMAIL (field_responder / $RESPONDER_ROLE)"
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
    --group-name "$GROUP_NAME" \
    --region "$REGION"

  echo "  home: /responder  responder_role=$RESPONDER_ROLE"
}

echo "═══════════════════════════════════════════════════════"
echo " Field Responder Cognito provision"
echo " Pool=$POOL_ID Agency=$AGENCY_ID Plan=$PLAN_ID"
echo "═══════════════════════════════════════════════════════"

ensure_group "$GROUP_NAME" "iQ Responder field unit dashboard (officer / firefighter / ems / unit_commander)"
ensure_responder_role_attribute

provision_user "responder-officer@appsondemand.net" "officer"
provision_user "responder-firefighter@appsondemand.net" "firefighter"
provision_user "responder-ems@appsondemand.net" "ems"
provision_user "responder-commander@appsondemand.net" "unit_commander"

echo ""
echo "Done. Four field_responder users on agency $AGENCY_ID in pool $POOL_ID."
echo "Password was not printed. Default is RapidCore2027! unless FIELD_RESPONDER_TEST_PASSWORD or RAPID_CORTEX_TEST_TEMP_PASSWORD is set."
echo "Sign in → expect /responder (not dispatcher)."
