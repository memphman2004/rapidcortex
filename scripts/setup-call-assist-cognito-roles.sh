#!/usr/bin/env bash
# Create Call Assist Cognito groups and demo users (admin, supervisor, operator).
set -euo pipefail

POOL_ID="${COGNITO_USER_POOL_ID:-us-east-1_0z6tA6WBs}"
REGION="${AWS_REGION:-us-east-1}"
AGENCY_ID="${CALL_ASSIST_TEST_AGENCY_ID:-kcpd}"
PASSWORD="${CALL_ASSIST_TEST_PASSWORD:-${RAPID_CORTEX_TEST_TEMP_PASSWORD:-RapidCore2027!}}"
PLAN_ID="${CALL_ASSIST_TEST_PLAN_ID:-command}"
SUB_STATUS="${CALL_ASSIST_TEST_SUB_STATUS:-active}"

ensure_group() {
  local GROUP_NAME="$1"
  local DESC="$2"
  if aws cognito-idp get-group --user-pool-id "$POOL_ID" --group-name "$GROUP_NAME" --region "$REGION" &>/dev/null; then
    echo "Group exists: $GROUP_NAME"
  else
    aws cognito-idp create-group \
      --user-pool-id "$POOL_ID" \
      --group-name "$GROUP_NAME" \
      --description "$DESC" \
      --region "$REGION"
    echo "Created group: $GROUP_NAME"
  fi
}

provision_user() {
  local EMAIL="$1"
  local ROLE="$2"
  local GROUP="$3"
  local HOME="$4"

  local ATTRS=(
    Name=email,Value="$EMAIL"
    Name=email_verified,Value=true
    Name="custom:role",Value="$ROLE"
    Name="custom:agencyId",Value="$AGENCY_ID"
    Name="custom:status",Value=active
    Name="custom:planId",Value="$PLAN_ID"
    Name="custom:subStatus",Value="$SUB_STATUS"
  )

  if aws cognito-idp admin-get-user --user-pool-id "$POOL_ID" --username "$EMAIL" --region "$REGION" &>/dev/null; then
    echo "Updating $EMAIL → $ROLE ($AGENCY_ID)"
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
    echo "Created $EMAIL ($ROLE)"
  fi

  aws cognito-idp admin-update-user-attributes \
    --user-pool-id "$POOL_ID" \
    --username "$EMAIL" \
    --user-attributes Name="custom:agencyVertical",Value=call_assist \
    --region "$REGION" 2>/dev/null || true

  aws cognito-idp admin-update-user-attributes \
    --user-pool-id "$POOL_ID" \
    --username "$EMAIL" \
    --user-attributes Name="custom:addons",Value="call_assist.module" \
    --region "$REGION" 2>/dev/null || true

  aws cognito-idp admin-set-user-password \
    --user-pool-id "$POOL_ID" \
    --username "$EMAIL" \
    --password "$PASSWORD" \
    --permanent \
    --region "$REGION"

  aws cognito-idp admin-add-user-to-group \
    --user-pool-id "$POOL_ID" \
    --username "$EMAIL" \
    --group-name "$GROUP" \
    --region "$REGION"

  aws cognito-idp admin-add-user-to-group \
    --user-pool-id "$POOL_ID" \
    --username "$EMAIL" \
    --group-name "vertical_call_assist" \
    --region "$REGION"

  echo "  home: $HOME"
}

ensure_group "CALL_ASSIST_ADMIN" "Call Assist administrator — non-emergency AI config"
ensure_group "CALL_ASSIST_SUPERVISOR" "Call Assist supervisor — live sessions, QA, analytics"
ensure_group "CALL_ASSIST_OPERATOR" "Call Assist operator — live non-emergency monitor"
ensure_group "vertical_call_assist" "Call Assist — non-emergency AI intake (no 911 dispatcher console)"

provision_user "${CALL_ASSIST_TEST_EMAIL:-CallAssist@appsondemand.net}" \
  "call_assist_admin" "CALL_ASSIST_ADMIN" "/app/call-assist/admin"
provision_user "${CALL_ASSIST_SUPERVISOR_EMAIL:-CallAssistSupervisor@appsondemand.net}" \
  "call_assist_supervisor" "CALL_ASSIST_SUPERVISOR" "/app/call-assist/supervisor"
provision_user "${CALL_ASSIST_OPERATOR_EMAIL:-CallAssistOperator@appsondemand.net}" \
  "call_assist_operator" "CALL_ASSIST_OPERATOR" "/app/call-assist/operator"

echo ""
echo "Done. Call Assist admin / supervisor / operator are on agency $AGENCY_ID in pool $POOL_ID."
echo "Password was not printed. Default is RapidCore2027! unless CALL_ASSIST_TEST_PASSWORD or RAPID_CORTEX_TEST_TEMP_PASSWORD is set."
