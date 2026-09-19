#!/usr/bin/env bash
# Monthly SOC 2 observation pack (READ-ONLY).
# Does not enable CloudTrail, WAF, PITR, or rotate secrets.
# Does not print secret values (describe-secret / list only).
#
# Usage:
#   AWS_PROFILE=rapid-cortex AWS_DEFAULT_REGION=us-east-1 \
#     bash scripts/soc2-observation-pack.sh
#
# Optional: SOC2_EVIDENCE_DIR=/path bash scripts/soc2-observation-pack.sh
set -u

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

export AWS_PROFILE="${AWS_PROFILE:-rapid-cortex}"
export AWS_DEFAULT_REGION="${AWS_DEFAULT_REGION:-us-east-1}"
export AWS_REGION="${AWS_REGION:-$AWS_DEFAULT_REGION}"

STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
MONTH="$(date -u +%Y-%m)"
OUT="${SOC2_EVIDENCE_DIR:-$ROOT/docs/evidence/soc2-evidence/${MONTH}}"
RAW="${OUT}/raw"
mkdir -p "$RAW"

TRAIL="${SOC2_CLOUDTRAIL_NAME:-rapid-cortex-cloudtrail-prod}"
POOL="${SOC2_COGNITO_POOL:-us-east-1_0z6tA6WBs}"
ACM_ALARM="${SOC2_ACM_ALARM:-rc-acm-cert-expiry-cc0f7fc4}"

log() { printf '[%s] %s\n' "$(date -u +%H:%M:%S)" "$*"; }

if ! command -v aws >/dev/null 2>&1; then
  echo "ERROR: aws CLI not found. Observation pack is read-only AWS evidence — install CLI and re-run." >&2
  echo "  Wrote empty dir ${OUT} was not created for a fake PASS." >&2
  exit 1
fi

run_json() {
  local name="$1"; shift
  local file="$RAW/${STAMP}-${name}.json"
  local err="$RAW/${STAMP}-${name}.stderr.txt"
  log "aws $*"
  if "$@" >"$file" 2>"$err"; then
    if [[ ! -s "$err" ]]; then rm -f "$err"; fi
    return 0
  fi
  local rc=$?
  log "FAIL ($rc) $name"
  return 0
}

log "Observation pack → $OUT stamp=$STAMP profile=$AWS_PROFILE"

run_json "00-sts" aws sts get-caller-identity
run_json "01-cloudtrail-status" aws cloudtrail get-trail-status --name "$TRAIL"
run_json "01-cloudtrail-describe" aws cloudtrail describe-trails --trail-name-list "$TRAIL"
run_json "01-cloudtrail-selectors" aws cloudtrail get-event-selectors --trail-name "$TRAIL"
run_json "02-cognito-mfa" aws cognito-idp get-user-pool-mfa-config --user-pool-id "$POOL"
run_json "02-cognito-describe" aws cognito-idp describe-user-pool --user-pool-id "$POOL"
run_json "03-acm-alarm" aws cloudwatch describe-alarms --alarm-names "$ACM_ALARM"
run_json "04-alarms-ok" aws cloudwatch describe-alarms --state-value OK --query 'MetricAlarms[?starts_with(AlarmName, `rapid-cortex`) || starts_with(AlarmName, `rc-`)].[AlarmName,StateValue]'
run_json "04-alarms-alarm" aws cloudwatch describe-alarms --state-value ALARM --query 'MetricAlarms[?starts_with(AlarmName, `rapid-cortex`) || starts_with(AlarmName, `rc-`)].[AlarmName,StateValue]'
run_json "05-secrets-list" aws secretsmanager list-secrets --query 'SecretList[?starts_with(Name, `rapid-cortex/`)].{Name:Name,ARN:ARN,RotationEnabled:RotationEnabled,LastChangedDate:LastChangedDate}'
run_json "06-auditor-role" aws iam get-role --role-name rapid-cortex-soc2-auditor

# PITR sample — core tables if they exist; never dumps items.
python3 - "$RAW" "$STAMP" <<'PY'
import json, subprocess, os, sys
raw, stamp = sys.argv[1:]
candidates = [
  "rapid-cortex-agencies-dev",
  "rapid-cortex-audit-dev",
  "rapid-cortex-incidents-dev",
  "rapid-cortex-transcripts-dev",
]
out = []
for table in candidates:
    proc = subprocess.run(
        ["aws", "dynamodb", "describe-continuous-backups", "--table-name", table],
        capture_output=True, text=True,
    )
    rec = {"table": table, "ok": proc.returncode == 0}
    if proc.returncode == 0:
        try:
            body = json.loads(proc.stdout)
            rec["pitr"] = body["ContinuousBackupsDescription"]["PointInTimeRecoveryDescription"]["PointInTimeRecoveryStatus"]
        except Exception as e:
            rec["parse_error"] = str(e)
    else:
        rec["stderr"] = (proc.stderr or "")[-500:]
    out.append(rec)
path = os.path.join(raw, f"{stamp}-03-pitr-sample.json")
with open(path, "w") as f:
    json.dump(out, f, indent=2)
    f.write("\n")
PY

# Cover sheet
cat > "${OUT}/COVER.md" <<EOF
# Observation pack ${MONTH}

- Collected (UTC): ${STAMP}
- Profile: ${AWS_PROFILE}
- Trail: ${TRAIL}
- Cognito pool: ${POOL}
- ACM alarm: ${ACM_ALARM}
- Command: \`bash scripts/soc2-observation-pack.sh\`
- **Read-only.** Not a Type II report.

Tick [monthly-control-check.md](../../../security-compliance/soc2/evidence/monthly-control-check.md).
EOF

log "Done. Review ${OUT}/raw and update the monthly control check."
