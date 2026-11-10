#!/usr/bin/env bash
# ADD-only: create field-responder Cognito group on the shared pool.
# Does not modify existing dispatch groups, MFA, or password policy.
set -euo pipefail

POOL_ID="${COGNITO_USER_POOL_ID:-us-east-1_0z6tA6WBs}"
REGION="${AWS_REGION:-us-east-1}"
export AWS_PROFILE="${AWS_PROFILE:-rapid-cortex}"

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

# Cognito group name uses hyphen; JWT custom:role remains field_responder.
ensure_group "field-responder" "iQ Responder field unit dashboard (officer / firefighter / ems / unit_commander)"

# custom:responder_role is an optional attribute (officer|firefighter|ems|unit_commander).
# Creating a custom attribute requires UpdateUserPool schema mutation — only document here.
# Operators set it via AdminUpdateUserAttributes when provisioning users:
#   Name=custom:responder_role,Value=officer

echo ""
echo "Done. Assign users with custom:role=field_responder and optional custom:responder_role."
echo "Add users to Cognito group field-responder."
