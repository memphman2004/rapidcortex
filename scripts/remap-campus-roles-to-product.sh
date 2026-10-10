#!/usr/bin/env bash
# Remap Cognito campus seats from legacy unsuffixed CAMPUS_* roles to product suffixes.
#
# Usage:
#   # UGA / higher-ed agency (required so they leave the K-12 dashboard)
#   AGENCY_ID=test-campus-uga PRODUCT=highered bash scripts/remap-campus-roles-to-product.sh
#
#   # Camden / K-12 (optional — legacy aliases already map to K-12)
#   AGENCY_ID=test-campus-camden PRODUCT=k12 bash scripts/remap-campus-roles-to-product.sh
#
# Dry run (default): prints planned changes. Set APPLY=1 to write Cognito attributes/groups.
set -euo pipefail

POOL_ID="${COGNITO_USER_POOL_ID:-us-east-1_0z6tA6WBs}"
REGION="${AWS_REGION:-us-east-1}"
AGENCY_ID="${AGENCY_ID:?Set AGENCY_ID (e.g. test-campus-uga)}"
PRODUCT="${PRODUCT:?Set PRODUCT=k12 or PRODUCT=highered}"
APPLY="${APPLY:-0}"

case "$PRODUCT" in
  k12|K12) SUFFIX="K12"; INSTITUTION_TYPE="k12" ;;
  highered|higher_ed|HIGHERED|HIGHER_ED) SUFFIX="HIGHERED"; INSTITUTION_TYPE="higher_ed" ;;
  *) echo "PRODUCT must be k12 or highered"; exit 1 ;;
esac

map_role() {
  local ROLE="$1"
  # Normalize compact / hyphenated tokens (campusadmin, campus-security, …)
  local NORM
  NORM=$(echo "$ROLE" | tr '[:upper:]' '[:lower:]' | tr '-' '_')
  case "$NORM" in
    campus_admin|campusadmin|campus_admin_k12|campus_admin_highered)
      echo "CAMPUS_ADMIN_${SUFFIX}" ;;
    campus_supervisor|campussupervisor|campus_supervisor_k12|campus_supervisor_highered)
      echo "CAMPUS_SUPERVISOR_${SUFFIX}" ;;
    campus_security|campussecurity|campus_security_k12|campus_security_highered)
      echo "CAMPUS_SECURITY_${SUFFIX}" ;;
    campus_dispatch|campusdispatch|campus_dispatch_k12|campus_dispatch_highered)
      echo "CAMPUS_DISPATCH_${SUFFIX}" ;;
    campus_counselor|campuscounselor|campus_counselor_k12|campus_counselor_highered)
      echo "CAMPUS_COUNSELOR_${SUFFIX}" ;;
    campus_faculty|campusfaculty|campus_faculty_k12|campus_faculty_highered)
      echo "CAMPUS_FACULTY_${SUFFIX}" ;;
    *) echo "" ;;
  esac
}

echo "Pool=$POOL_ID agencyId=$AGENCY_ID → PRODUCT=$PRODUCT (*_${SUFFIX})"
echo "APPLY=$APPLY (set APPLY=1 to write)"
echo ""

# Pagination token for ListUsers
TOKEN=""
while true; do
  if [[ -n "$TOKEN" ]]; then
    PAGE=$(aws cognito-idp list-users --user-pool-id "$POOL_ID" --region "$REGION" \
      --pagination-token "$TOKEN" --limit 60 --output json)
  else
    PAGE=$(aws cognito-idp list-users --user-pool-id "$POOL_ID" --region "$REGION" \
      --limit 60 --output json)
  fi

  echo "$PAGE" | python3 -c '
import json, os, sys
data = json.load(sys.stdin)
agency = os.environ["AGENCY_ID"]
for u in data.get("Users", []):
    attrs = {a["Name"]: a.get("Value", "") for a in u.get("Attributes", [])}
    if attrs.get("custom:agencyId") != agency:
        continue
    username = u.get("Username", "")
    role = attrs.get("custom:role", "")
    print(f"{username}\t{role}")
' AGENCY_ID="$AGENCY_ID" | while IFS=$'\t' read -r USERNAME OLD_ROLE; do
    [[ -z "$USERNAME" ]] && continue
    NEW_ROLE=$(map_role "$OLD_ROLE")
    if [[ -z "$NEW_ROLE" ]]; then
      echo "skip $USERNAME (role=$OLD_ROLE not campus)"
      continue
    fi
    if [[ "$OLD_ROLE" == "$NEW_ROLE" ]]; then
      echo "ok   $USERNAME already $NEW_ROLE"
      continue
    fi
    echo "map  $USERNAME  $OLD_ROLE → $NEW_ROLE"
    if [[ "$APPLY" == "1" ]]; then
      # Role suffix is the product signal; custom:institutionType is not on all pools.
      aws cognito-idp admin-update-user-attributes \
        --user-pool-id "$POOL_ID" \
        --username "$USERNAME" \
        --user-attributes Name="custom:role",Value="$NEW_ROLE" \
        --region "$REGION"
      aws cognito-idp admin-add-user-to-group \
        --user-pool-id "$POOL_ID" \
        --username "$USERNAME" \
        --group-name "$NEW_ROLE" \
        --region "$REGION" 2>/dev/null || true
      # Best-effort remove from legacy group
      if [[ "$OLD_ROLE" != "$NEW_ROLE" ]]; then
        aws cognito-idp admin-remove-user-from-group \
          --user-pool-id "$POOL_ID" \
          --username "$USERNAME" \
          --group-name "$OLD_ROLE" \
          --region "$REGION" 2>/dev/null || true
      fi
    fi
  done

  TOKEN=$(echo "$PAGE" | python3 -c 'import json,sys; print(json.load(sys.stdin).get("PaginationToken") or "")')
  [[ -z "$TOKEN" ]] && break
done

echo ""
if [[ "$APPLY" != "1" ]]; then
  echo "Dry run complete. Re-run with APPLY=1 to write Cognito."
else
  echo "Apply complete."
fi
