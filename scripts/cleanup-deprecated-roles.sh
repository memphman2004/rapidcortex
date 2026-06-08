#!/usr/bin/env bash
# cleanup-deprecated-roles.sh
#
# Removes deprecated Cognito groups and migrates affected users.
#
# Roles being removed:
#   commsupervisor   — duplicate of supervisor; users migrated to supervisor
#   CAMPUS_COUNSELOR — no product functionality
#   CAMPUS_FACULTY   — not an operator role
#   TRANSIT_ADMIN    — vertical not yet built
#   TRANSIT_SUPERVISOR
#   TRANSIT_SECURITY
#   TRANSIT_OPERATOR
#
# commsupervisor is handled specially:
#   - Users are migrated to supervisor (role attribute updated)
#   - Users added to supervisor Cognito group
#   - Users removed from commsupervisor group
#   - Group deleted
#
# All other deprecated groups:
#   - Aborts if any non-test user is found (safety gate)
#   - Removes group members, deletes group
#
# Usage:
#   bash scripts/cleanup-deprecated-roles.sh          # dry-run (default)
#   DRY_RUN=0 bash scripts/cleanup-deprecated-roles.sh  # live run
#
# Env:
#   COGNITO_USER_POOL_ID  (default: us-east-1_QgqAYyRwg)
#   AWS_REGION            (default: us-east-1)
#   DRY_RUN               (default: 1)
#
set -euo pipefail

POOL_ID="${COGNITO_USER_POOL_ID:-us-east-1_0z6tA6WBs}"
REGION="${AWS_REGION:-us-east-1}"
DRY_RUN="${DRY_RUN:-1}"

# Test account domain — users at this domain are safe to modify without warning
TEST_DOMAIN="appsondemand.net"

# ── Helpers ───────────────────────────────────────────────────────────────────

run() {
  if [[ "$DRY_RUN" == "1" ]]; then
    echo "  [DRY RUN] $*"
  else
    "$@"
  fi
}

ok()   { echo "  ✅ $*"; }
warn() { echo "  ⚠️  $*"; }
info() { echo "  ℹ️  $*"; }
die()  { echo "ERROR: $*" >&2; exit 1; }

group_exists() {
  aws cognito-idp get-group \
    --user-pool-id "$POOL_ID" \
    --group-name "$1" \
    --region "$REGION" \
    --output text \
    --query 'Group.GroupName' \
    2>/dev/null || true
}

list_group_users() {
  aws cognito-idp list-users-in-group \
    --user-pool-id "$POOL_ID" \
    --group-name "$1" \
    --region "$REGION" \
    --query 'Users[].Username' \
    --output text \
    2>/dev/null || true
}

list_role_users() {
  # Cognito ListUsers cannot filter on custom attributes — query client-side.
  aws cognito-idp list-users \
    --user-pool-id "$POOL_ID" \
    --region "$REGION" \
    --query "Users[?Attributes[?Name=='custom:role' && Value=='$1']].Username" \
    --output text \
    2>/dev/null || true
}

user_email() {
  aws cognito-idp admin-get-user \
    --user-pool-id "$POOL_ID" \
    --username "$1" \
    --region "$REGION" \
    --query "UserAttributes[?Name=='email'].Value | [0]" \
    --output text \
    2>/dev/null || true
}

is_test_user() {
  local username="$1"
  if [[ "$username" == *"$TEST_DOMAIN"* ]]; then
    return 0
  fi
  local email
  email="$(user_email "$username")"
  [[ -n "$email" && "$email" == *"$TEST_DOMAIN"* ]]
}

reassign_test_users_role() {
  local from_role="$1"
  local to_role="$2"
  local attr_users group_users users
  attr_users="$(list_role_users "$from_role")"
  group_users="$(list_group_users "$from_role")"
  users="$(echo -e "${attr_users}\n${group_users}" | sort -u | grep -v '^$' || true)"

  for user in $users; do
    if ! is_test_user "$user"; then
      continue
    fi
    run aws cognito-idp admin-update-user-attributes \
      --user-pool-id "$POOL_ID" \
      --username "$user" \
      --user-attributes Name=custom:role,Value="$to_role" \
      --region "$REGION"
    ok "Reassigned test user $user: $from_role → $to_role"
  done
}

# Removes all users from a group, then deletes the group
delete_group() {
  local group="$1"
  local gname

  gname="$(group_exists "$group")"
  if [[ -z "$gname" ]]; then
    info "Group '$group' does not exist — skip"
    return
  fi

  local users
  users="$(list_group_users "$group")"

  if [[ -n "$users" ]]; then
    for user in $users; do
      run aws cognito-idp admin-remove-user-from-group \
        --user-pool-id "$POOL_ID" \
        --username "$user" \
        --group-name "$group" \
        --region "$REGION"
      ok "Removed $user from group $group"
    done
  else
    info "Group '$group' is empty"
  fi

  run aws cognito-idp delete-group \
    --user-pool-id "$POOL_ID" \
    --group-name "$group" \
    --region "$REGION"
  ok "Deleted group: $group"
}

# Aborts if any non-test users have the given custom:role attribute or group membership
assert_no_real_users() {
  local role="$1"
  local attr_users group_users users
  attr_users="$(list_role_users "$role")"
  group_users="$(list_group_users "$role")"
  users="$(echo -e "${attr_users}\n${group_users}" | sort -u | grep -v '^$' || true)"

  local real_users=()
  for user in $users; do
    if ! is_test_user "$user"; then
      real_users+=("$user")
    fi
  done

  if [[ ${#real_users[@]} -gt 0 ]]; then
    die "Real users found with role '$role': ${real_users[*]}
  Update their role manually before running this script.
  Example: aws cognito-idp admin-update-user-attributes \\
    --user-pool-id $POOL_ID --username <email> \\
    --user-attributes Name=custom:role,Value=<new-role>"
  fi

  local count=0
  [[ -n "$users" ]] && count=$(echo "$users" | wc -w | tr -d ' ')
  info "Role '$role': $count test user(s) only — safe to remove"
}

# ── Banner ─────────────────────────────────────────────────────────────────────

echo ""
echo "=== cleanup-deprecated-roles.sh ==="
echo "Pool  : $POOL_ID"
echo "Region: $REGION"
if [[ "$DRY_RUN" == "1" ]]; then
  echo "Mode  : DRY RUN — no changes will be made"
  echo "        Set DRY_RUN=0 to apply."
else
  echo "Mode  : LIVE — changes will be applied to Cognito"
fi
echo ""

# ── 1. commsupervisor → supervisor (migration + delete) ───────────────────────
echo "── Step 1: Migrate commsupervisor → supervisor ──────────────────────────"

COMM_USERS="$(list_role_users "commsupervisor")"
COMM_GROUP_USERS="$(list_group_users "commsupervisor" 2>/dev/null || true)"

# Combine both lists (attribute + group membership), deduplicate
ALL_COMM_USERS="$(echo -e "${COMM_USERS}\n${COMM_GROUP_USERS}" | sort -u | grep -v '^$' || true)"

if [[ -z "$ALL_COMM_USERS" ]]; then
  info "No users found with commsupervisor role or group — nothing to migrate"
else
  for user in $ALL_COMM_USERS; do
    echo "  Migrating: $user"

    # Update custom:role attribute → supervisor
    run aws cognito-idp admin-update-user-attributes \
      --user-pool-id "$POOL_ID" \
      --username "$user" \
      --user-attributes Name=custom:role,Value=supervisor \
      --region "$REGION"

    # Add to supervisor group (idempotent — ok if already a member)
    run aws cognito-idp admin-add-user-to-group \
      --user-pool-id "$POOL_ID" \
      --username "$user" \
      --group-name "supervisor" \
      --region "$REGION" 2>/dev/null || \
      warn "Could not add $user to supervisor group (group may not exist yet)"

    # Remove from commsupervisor group
    run aws cognito-idp admin-remove-user-from-group \
      --user-pool-id "$POOL_ID" \
      --username "$user" \
      --group-name "commsupervisor" \
      --region "$REGION" 2>/dev/null || true

    ok "$user → supervisor"
  done
fi

# Delete the commsupervisor group
delete_group "commsupervisor"
echo ""

# ── 2. Campus roles — no real users expected ──────────────────────────────────
echo "── Step 2: Remove CAMPUS_COUNSELOR and CAMPUS_FACULTY ──────────────────"

for role in CAMPUS_COUNSELOR CAMPUS_FACULTY; do
  echo ""
  echo "  Processing: $role"
  assert_no_real_users "$role"
  reassign_test_users_role "$role" "CAMPUS_DISPATCH"
  delete_group "$role"
done
echo ""

# ── 3. Transit roles — vertical not built ────────────────────────────────────
echo "── Step 3: Remove TRANSIT_* roles (vertical not yet implemented) ────────"

for role in TRANSIT_ADMIN TRANSIT_SUPERVISOR TRANSIT_SECURITY TRANSIT_OPERATOR; do
  echo ""
  echo "  Processing: $role"
  assert_no_real_users "$role"
  reassign_test_users_role "$role" "dispatcher"
  delete_group "$role"
done
echo ""

# ── Verification ───────────────────────────────────────────────────────────────
echo "── Verification ─────────────────────────────────────────────────────────"
echo ""
echo "  Current Cognito groups:"
aws cognito-idp list-groups \
  --user-pool-id "$POOL_ID" \
  --region "$REGION" \
  --query 'sort_by(Groups, &GroupName)[].GroupName' \
  --output table

echo ""
if [[ "$DRY_RUN" == "1" ]]; then
  echo "Dry run complete. To apply: DRY_RUN=0 bash scripts/cleanup-deprecated-roles.sh"
else
  echo "Done. Run the following to verify user roles:"
  echo ""
  echo "  aws cognito-idp list-users \\"
  echo "    --user-pool-id $POOL_ID \\"
  echo "    --region $REGION \\"
  echo "    --query 'Users[*].{Email:Attributes[?Name==\`email\`].Value|[0],Role:Attributes[?Name==\`custom:role\`].Value|[0]}' \\"
  echo "    --output table"
fi
echo ""
