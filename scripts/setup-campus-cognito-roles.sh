#!/usr/bin/env bash
# Create campus Cognito groups (K-12 + Higher-ed product roles) and optional QA users.
# Campus Dynamo config (buildings/zones) is separate: apps/api/src/scripts/seed-campus-test-agency.ts
#
# Product split: custom:role suffix drives dashboard nav.
#   *_K12       → K-12 school district console
#   *_HIGHERED  → University / college (Clery) console
# Legacy unsuffixed CAMPUS_* groups are kept for alias compatibility (map → K-12 in app code).
set -euo pipefail

POOL_ID="${COGNITO_USER_POOL_ID:-us-east-1_0z6tA6WBs}"
REGION="${AWS_REGION:-us-east-1}"
AGENCY_ID="${CAMPUS_TEST_AGENCY_ID:-test-campus-uga}"
PASSWORD="${CAMPUS_TEST_PASSWORD:-${RAPID_CORTEX_TEST_TEMP_PASSWORD:-RapidTest2026!}}"
PLAN_ID="${CAMPUS_TEST_PLAN_ID:-essential}"
SUB_STATUS="${CAMPUS_TEST_SUB_STATUS:-active}"
# higher_ed (default) | k12 — selects which product roles get seeded for test users
INSTITUTION_TYPE="${CAMPUS_INSTITUTION_TYPE:-higher_ed}"

if [[ "$INSTITUTION_TYPE" == "k12" ]]; then
  PRODUCT_SUFFIX="K12"
else
  PRODUCT_SUFFIX="HIGHERED"
  INSTITUTION_TYPE="higher_ed"
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

# Product-suffixed groups (canonical)
for FAMILY in ADMIN SUPERVISOR SECURITY DISPATCH COUNSELOR FACULTY; do
  ensure_group "CAMPUS_${FAMILY}_K12" "Campus ${FAMILY} (K-12)"
  ensure_group "CAMPUS_${FAMILY}_HIGHERED" "Campus ${FAMILY} (Higher-ed)"
done

# Legacy unsuffixed groups (alias → K-12 in app; keep for existing Camden seats)
ensure_group "CAMPUS_ADMIN" "Campus safety administrator (legacy → K-12)"
ensure_group "CAMPUS_SUPERVISOR" "Campus shift supervisor (legacy → K-12)"
ensure_group "CAMPUS_SECURITY" "Campus security officer (legacy → K-12)"
ensure_group "CAMPUS_DISPATCH" "Campus dispatch / comms (legacy → K-12)"
ensure_group "CAMPUS_COUNSELOR" "Campus counselor / wellness (legacy → K-12)"
ensure_group "CAMPUS_FACULTY" "Campus faculty read-only (legacy → K-12)"

create_campus_user() {
  local EMAIL="$1"
  local ROLE="$2"

  if aws cognito-idp admin-get-user --user-pool-id "$POOL_ID" --username "$EMAIL" --region "$REGION" &>/dev/null; then
    echo "⚠️  Updating $EMAIL → $ROLE (institutionType=$INSTITUTION_TYPE)"
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

  aws cognito-idp admin-update-user-attributes \
    --user-pool-id "$POOL_ID" \
    --username "$EMAIL" \
    --user-attributes Name="custom:institutionType",Value="$INSTITUTION_TYPE" \
    --region "$REGION" 2>/dev/null \
    || echo "ℹ️  custom:institutionType not on pool (role suffix drives dashboard product)"

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
  create_campus_user "campusadmin@appsondemand.net" "CAMPUS_ADMIN_${PRODUCT_SUFFIX}"
  create_campus_user "campussupervisor@appsondemand.net" "CAMPUS_SUPERVISOR_${PRODUCT_SUFFIX}"
  create_campus_user "campussecurity@appsondemand.net" "CAMPUS_SECURITY_${PRODUCT_SUFFIX}"
  create_campus_user "campusdispatch@appsondemand.net" "CAMPUS_DISPATCH_${PRODUCT_SUFFIX}"
  create_campus_user "campuscounselor@appsondemand.net" "CAMPUS_COUNSELOR_${PRODUCT_SUFFIX}"
  create_campus_user "campusfaculty@appsondemand.net" "CAMPUS_FACULTY_${PRODUCT_SUFFIX}"
fi

echo ""
echo "Done. Campus product groups provisioned in pool $POOL_ID (agencyId=$AGENCY_ID)."
echo "Set CREATE_CAMPUS_TEST_USERS=1 to provision test accounts with *_${PRODUCT_SUFFIX} roles."
echo "CAMPUS_INSTITUTION_TYPE=k12       → seed *_K12 roles (Camden)"
echo "CAMPUS_INSTITUTION_TYPE=higher_ed → seed *_HIGHERED roles (UGA, default)"
echo "Remap existing seats: bash scripts/remap-campus-roles-to-product.sh"
echo "Seed campus buildings/zones: CAMPUS_CONFIG_TABLE=... npx tsx apps/api/src/scripts/seed-campus-test-agency.ts UGA"
echo "Seed K-12 Camden demo: npx tsx apps/api/src/scripts/seed-k12-camden-demo.ts"
