#!/usr/bin/env bash
# organize-cognito-by-vertical.sh
# Creates vertical origin groups in Cognito and assigns all existing users
# based on their custom:agencyId and custom:role attributes.
#
# Groups created:
#   vertical_911       — 911 PSAP dispatchers, supervisors, admins
#   vertical_campus    — Campus safety users
#   vertical_venue     — Venue security users
#   vertical_transit   — Transit security users
#   vertical_hospital  — Hospital users
#   vertical_ring      — Ring homeowners and Ring reviewer accounts
#   vertical_platform  — Rapid Cortex platform/admin accounts
#
# Mapping must stay in sync with packages/shared/src/auth/cognito-vertical-group.ts
#
# Usage:
#   AWS_PROFILE=rapid-cortex bash scripts/organize-cognito-by-vertical.sh
#
# Dry run (preview only, no changes) — default:
#   DRY_RUN=1 AWS_PROFILE=rapid-cortex bash scripts/organize-cognito-by-vertical.sh
#
# Apply:
#   DRY_RUN=0 AWS_PROFILE=rapid-cortex bash scripts/organize-cognito-by-vertical.sh
set -euo pipefail

POOL="${COGNITO_USER_POOL_ID:-us-east-1_0z6tA6WBs}"
REGION="${AWS_REGION:-us-east-1}"
DRY_RUN="${DRY_RUN:-1}"

info()  { echo "  ℹ $*"; }
ok()    { echo "  ✅ $*"; }
warn()  { echo "  ⚠️  $*" >&2; }
skip()  { echo "  ↩  $*"; }

run() {
  if [[ "$DRY_RUN" == "1" ]]; then
    echo "  [DRY RUN] $*"
  else
    "$@"
  fi
}

# Ordered so Step 1 / Step 3 output is stable (no bash 4 associative arrays — macOS /bin/bash is 3.2).
VERTICAL_GROUPS=(
  vertical_platform
  vertical_911
  vertical_campus
  vertical_venue
  vertical_transit
  vertical_hospital
  vertical_ring
)

group_description() {
  case "$1" in
    vertical_platform) echo "Platform — Rapid Cortex internal admin accounts" ;;
    vertical_911) echo "911 PSAP — dispatchers, supervisors, agency admins, analysts" ;;
    vertical_campus) echo "Campus safety — campus admins, security, dispatch, faculty" ;;
    vertical_venue) echo "Venue security — venue admins, operators, supervisors" ;;
    vertical_transit) echo "Transit security — transit safety personnel" ;;
    vertical_hospital) echo "Hospital — hospital coordinators and staff" ;;
    vertical_ring) echo "Ring — homeowners and Ring integration reviewer accounts" ;;
    *) echo "" ;;
  esac
}

echo ""
echo "=== organize-cognito-by-vertical ==="
echo "  Pool:   $POOL"
echo "  Region: $REGION"
echo "  Mode:   $([ "$DRY_RUN" == "1" ] && echo 'DRY RUN' || echo 'LIVE')"
echo ""
echo "── Step 1: Ensure vertical groups exist ─────────────────────────────────"

for group in "${VERTICAL_GROUPS[@]}"; do
  desc="$(group_description "$group")"
  exists="$(aws cognito-idp get-group \
    --user-pool-id "$POOL" \
    --group-name "$group" \
    --region "$REGION" \
    --query "Group.GroupName" \
    --output text 2>/dev/null || true)"

  if [[ "$exists" == "$group" ]]; then
    skip "Group already exists: $group"
  elif [[ "$DRY_RUN" == "1" ]]; then
    skip "Would create group: $group"
  else
    info "Creating group: $group"
    aws cognito-idp create-group \
      --user-pool-id "$POOL" \
      --group-name "$group" \
      --description "$desc" \
      --region "$REGION" > /dev/null
    ok "Created: $group"
  fi
done

echo ""
echo "── Step 2: Assign users to vertical groups ──────────────────────────────"
echo ""

PLAN_FILE="$(mktemp)"
trap 'rm -f "$PLAN_FILE"' EXIT

POOL="$POOL" REGION="$REGION" python3 - "$PLAN_FILE" <<'PY'
import json, os, subprocess, sys

POOL = os.environ["POOL"]
REGION = os.environ["REGION"]
PLAN_PATH = sys.argv[1]
RING_REVIEWER = "ring-reviewer@rapidcortex.us"
GROUPS = [
    "vertical_platform",
    "vertical_911",
    "vertical_campus",
    "vertical_venue",
    "vertical_transit",
    "vertical_hospital",
    "vertical_ring",
]

def aws_json(args, *, ignore_missing=False):
    try:
        raw = subprocess.check_output(
            ["aws", *args, "--region", REGION, "--output", "json"],
            stderr=subprocess.DEVNULL if ignore_missing else None,
        )
        return json.loads(raw)
    except subprocess.CalledProcessError:
        if ignore_missing:
            return {}
        raise

def paginate_users():
    token = None
    users = []
    while True:
        args = ["cognito-idp", "list-users", "--user-pool-id", POOL]
        if token:
            args += ["--pagination-token", token]
        data = aws_json(args)
        users.extend(data.get("Users") or [])
        token = data.get("PaginationToken")
        if not token:
            break
    return users

def paginate_group(group):
    token = None
    names = set()
    while True:
        args = ["cognito-idp", "list-users-in-group", "--user-pool-id", POOL, "--group-name", group]
        if token:
            args += ["--next-token", token]
        data = aws_json(args, ignore_missing=True)
        if not data:
            return names
        for u in data.get("Users") or []:
            n = u.get("Username")
            if n:
                names.add(n)
        token = data.get("NextToken")
        if not token:
            break
    return names

def vertical_group(agency_id, role, email):
    # Keep in sync with packages/shared/src/auth/cognito-vertical-group.ts
    agency = (agency_id or "").strip()
    role_lc = (role or "").strip().lower()
    email_lc = (email or "").strip().lower()
    agency_lc = agency.lower()
    if agency == "__platform__" or role_lc.startswith("rc"):
        return "vertical_platform"
    if role_lc == "homeowner" or email_lc == RING_REVIEWER:
        return "vertical_ring"
    if "campus" in agency_lc or role_lc.startswith("campus_"):
        return "vertical_campus"
    if "venue" in agency_lc or role_lc.startswith("venue_"):
        return "vertical_venue"
    if "transit" in agency_lc or role_lc.startswith("transit_"):
        return "vertical_transit"
    if (
        "hospital" in agency_lc
        or role_lc.startswith("hospital_")
        or role_lc in ("hospitaladmin", "hospitalstaff")
    ):
        return "vertical_hospital"
    if agency:
        return "vertical_911"
    return None

users = paginate_users()
members = {g: paginate_group(g) for g in GROUPS}

rows = []
skipped = []
for u in users:
    attrs = {a["Name"]: a.get("Value", "") for a in u.get("Attributes") or []}
    username = u.get("Username") or ""
    email = attrs.get("email", "unknown")
    agency_id = attrs.get("custom:agencyId", "")
    role = attrs.get("custom:role", "")
    group = vertical_group(agency_id, role, email)
    if not group:
        skipped.append({"email": email, "agencyId": agency_id, "role": role})
        continue
    rows.append({
        "username": username,
        "email": email,
        "group": group,
        "already": username in members.get(group, set()),
    })

with open(PLAN_PATH, "w", encoding="utf-8") as fh:
    for row in rows:
        fh.write(
            "\t".join(
                [
                    "1" if row["already"] else "0",
                    row["username"],
                    row["email"],
                    row["group"],
                ]
            )
            + "\n"
        )

print(f"  Found {len(users)} users to process.")
print("")
for s in skipped:
    print(
        f"  ⚠️  Cannot determine vertical for {s['email']} "
        f"(agencyId='{s['agencyId']}' role='{s['role']}') — skipping"
    )
PY

while IFS=$'\t' read -r already username email vertical; do
  [[ -z "${username:-}" ]] && continue
  if [[ "$already" == "1" ]]; then
    skip "$email → $vertical (already assigned)"
  else
    echo "  Assigning: $email → $vertical"
    run aws cognito-idp admin-add-user-to-group \
      --user-pool-id "$POOL" \
      --username "$username" \
      --group-name "$vertical" \
      --region "$REGION"
    ok "$email → $vertical"
  fi
done < "$PLAN_FILE"

echo ""
echo "── Step 3: Verification ─────────────────────────────────────────────────"
echo ""

for group in "${VERTICAL_GROUPS[@]}"; do
  count="$(
    POOL="$POOL" REGION="$REGION" GROUP="$group" python3 - <<'PY'
import json, os, subprocess
pool, region, group = os.environ["POOL"], os.environ["REGION"], os.environ["GROUP"]
token = None
n = 0
while True:
    args = [
        "aws", "cognito-idp", "list-users-in-group",
        "--user-pool-id", pool, "--group-name", group, "--region", region, "--output", "json",
    ]
    if token:
        args += ["--next-token", token]
    try:
        data = json.loads(subprocess.check_output(args, stderr=subprocess.DEVNULL))
    except subprocess.CalledProcessError:
        print(0)
        raise SystemExit
    n += len(data.get("Users") or [])
    token = data.get("NextToken")
    if not token:
        break
print(n)
PY
  )"
  printf "  %-22s %s users\n" "$group" "$count"
done

echo ""
echo "=== Done ==="
if [[ "$DRY_RUN" == "1" ]]; then
  echo ""
  echo "  This was a dry run. To apply: DRY_RUN=0 AWS_PROFILE=${AWS_PROFILE:-rapid-cortex} bash scripts/organize-cognito-by-vertical.sh"
fi
echo ""
echo "  View groups in AWS Console:"
echo "  Cognito → User Pools → $POOL → Groups"
echo ""
echo "  New users are assigned at create time (PostConfirmation, admin create,"
echo "  Ring homeowner signup, hospital portal). Re-run this script after a bulk import."
echo ""
