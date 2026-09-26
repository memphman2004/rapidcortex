#!/usr/bin/env bash
# Quarterly access-review export (READ-ONLY).
# Lists IAM users (MFA, key metadata) and Cognito privileged group members.
# Does not disable users, rotate keys, or print secret values / passwords.
#
# Usage:
#   AWS_PROFILE=rapid-cortex AWS_DEFAULT_REGION=us-east-1 \
#     bash scripts/soc2-access-review.sh
set -u

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

export AWS_PROFILE="${AWS_PROFILE:-rapid-cortex}"
export AWS_DEFAULT_REGION="${AWS_DEFAULT_REGION:-us-east-1}"
export AWS_REGION="${AWS_REGION:-$AWS_DEFAULT_REGION}"

STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
MONTH="$(date -u +%Y-%m)"
OUT="${SOC2_EVIDENCE_DIR:-$ROOT/docs/evidence/soc2-evidence/${MONTH}/access-review}"
mkdir -p "$OUT"

POOL="${SOC2_COGNITO_POOL:-us-east-1_0z6tA6WBs}"

log() { printf '[%s] %s\n' "$(date -u +%H:%M:%S)" "$*"; }

if ! command -v aws >/dev/null 2>&1; then
  echo "ERROR: aws CLI not found. Cannot export access review." >&2
  exit 1
fi

log "Access review export → $OUT"

aws sts get-caller-identity > "$OUT/${STAMP}-sts.json" 2>"$OUT/${STAMP}-sts.stderr.txt" || true
aws iam list-users > "$OUT/${STAMP}-iam-users.json" 2>"$OUT/${STAMP}-iam-users.stderr.txt" || true
aws iam list-virtual-mfa-devices > "$OUT/${STAMP}-iam-virtual-mfa.json" 2>"$OUT/${STAMP}-iam-virtual-mfa.stderr.txt" || true
aws iam list-roles --query 'Roles[?starts_with(RoleName, `rapid-cortex`)].{RoleName:RoleName,Arn:Arn}' > "$OUT/${STAMP}-iam-rc-roles.json" 2>"$OUT/${STAMP}-iam-rc-roles.stderr.txt" || true
aws iam get-role --role-name rapid-cortex-soc2-auditor > "$OUT/${STAMP}-auditor-role.json" 2>"$OUT/${STAMP}-auditor-role.stderr.txt" || true
aws iam list-access-keys --query 'AccessKeyMetadata' >/dev/null 2>&1 || true

python3 - "$OUT" "$STAMP" <<'PY'
import json, os, subprocess, sys
out, stamp = sys.argv[1:]
users_path = os.path.join(out, f"{stamp}-iam-users.json")
rows = []
try:
    users = json.load(open(users_path)).get("Users") or []
except Exception:
    users = []
for u in users:
    name = u.get("UserName")
    rec = {"UserName": name, "CreateDate": u.get("CreateDate"), "PasswordLastUsed": u.get("PasswordLastUsed")}
    mfa = subprocess.run(["aws", "iam", "list-mfa-devices", "--user-name", name], capture_output=True, text=True)
    rec["mfaOk"] = False
    if mfa.returncode == 0:
        try:
            rec["mfaCount"] = len(json.loads(mfa.stdout).get("MFADevices") or [])
            rec["mfaOk"] = rec["mfaCount"] > 0
        except Exception:
            rec["mfaCount"] = None
    keys = subprocess.run(["aws", "iam", "list-access-keys", "--user-name", name], capture_output=True, text=True)
    rec["accessKeys"] = []
    if keys.returncode == 0:
        for k in (json.loads(keys.stdout).get("AccessKeyMetadata") or []):
            rec["accessKeys"].append({
                "AccessKeyId": k.get("AccessKeyId"),
                "Status": k.get("Status"),
                "CreateDate": k.get("CreateDate"),
            })
    rows.append(rec)
with open(os.path.join(out, f"{stamp}-iam-user-review.json"), "w") as f:
    json.dump(rows, f, indent=2, default=str)
    f.write("\n")
PY

# Privileged Cognito groups — usernames only (emails may appear in AWS JSON; keep artifacts private).
for group in rcsuperadmin rcadmin rcitadmin; do
  safe="${group}"
  aws cognito-idp list-users-in-group --user-pool-id "$POOL" --group-name "$group" \
    > "$OUT/${STAMP}-cognito-group-${safe}.json" 2>"$OUT/${STAMP}-cognito-group-${safe}.stderr.txt" || true
done

aws cognito-idp get-user-pool-mfa-config --user-pool-id "$POOL" > "$OUT/${STAMP}-cognito-mfa.json" 2>"$OUT/${STAMP}-cognito-mfa.stderr.txt" || true

cat > "$OUT/README.md" <<EOF
# Access review export ${MONTH}

- Stamp: ${STAMP}
- Pool: ${POOL}
- Read-only. Complete [access-review-log.md](../../../../security-compliance/soc2/evidence/access-review-log.md).
- If this directory contains emails, keep it out of public forks; it may still be committed to the private origin.
EOF

log "Done. Review IAM MFA gaps and Cognito privileged groups, then sign the ledger."
