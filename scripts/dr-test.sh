#!/usr/bin/env bash
# NexCort iQ disaster-recovery readiness check.
#
# Usage:
#   bash scripts/dr-test.sh [STAGE]
#   STAGE defaults to staging
#
# Checks DynamoDB PITR on key rapid-cortex-* tables and CloudTrail logging.
# Soft delete/restore exercises run ONLY when SAFE_DR_DESTRUCTIVE=1 (default off).
#
# Exit codes:
#   0 — all critical checks passed (or AWS unreachable → graceful degrade with report)
#   1 — critical failures while AWS was reachable
#   2 — usage / local prerequisite failure
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

STAGE="${1:-staging}"
SAFE_DR_DESTRUCTIVE="${SAFE_DR_DESTRUCTIVE:-0}"
export AWS_PROFILE="${AWS_PROFILE:-rapid-cortex}"
export AWS_DEFAULT_REGION="${AWS_DEFAULT_REGION:-us-east-1}"
export AWS_REGION="${AWS_REGION:-$AWS_DEFAULT_REGION}"

TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"
OUT_DIR="$ROOT/docs/dr-test-results"
REPORT="$OUT_DIR/dr-test-${STAGE}-${TIMESTAMP}.md"
mkdir -p "$OUT_DIR"

PREFIX="${DYNAMO_TABLE_PREFIX:-rapid-cortex}"
KEY_TABLES=(
  "${PREFIX}-incidents-${STAGE}"
  "${PREFIX}-agencies-${STAGE}"
  "${PREFIX}-audit-${STAGE}"
  "${PREFIX}-transcripts-${STAGE}"
  "${PREFIX}-analyses-${STAGE}"
)

CRITICAL_FAILS=0
WARNINGS=0
AWS_REACHABLE=0

log() { printf '[%s] %s\n' "$(date -u +%H:%M:%S)" "$*"; }

append_md() {
  printf '%s\n' "$*" >> "$REPORT"
}

if ! command -v aws >/dev/null 2>&1; then
  echo "ERROR: aws CLI not found." >&2
  exit 2
fi

{
  cat <<EOF
# DR test report — ${STAGE}

- Generated (UTC): ${TIMESTAMP}
- Region: ${AWS_REGION}
- Profile: ${AWS_PROFILE}
- SAFE_DR_DESTRUCTIVE: ${SAFE_DR_DESTRUCTIVE}
- Table prefix: ${PREFIX}

## Summary

EOF
} > "$REPORT"

log "Probing AWS connectivity…"
if aws sts get-caller-identity >/dev/null 2>&1; then
  AWS_REACHABLE=1
  ACCOUNT_ID="$(aws sts get-caller-identity --query Account --output text 2>/dev/null || echo unknown)"
  append_md "- AWS reachable: **yes** (account \`${ACCOUNT_ID}\`)"
  log "AWS OK (account ${ACCOUNT_ID})"
else
  append_md "- AWS reachable: **no** — checks skipped; exit 0 (graceful degrade)"
  append_md ""
  append_md "## Skipped"
  append_md ""
  append_md "Could not call \`sts get-caller-identity\`. Configure credentials/profile and re-run."
  append_md ""
  append_md "## Result"
  append_md ""
  append_md "**DEGRADED** — no critical failures asserted (AWS unreachable)."
  log "AWS unreachable — writing degraded report and exiting 0"
  echo "Report: $REPORT"
  exit 0
fi

append_md ""
append_md "## DynamoDB PITR"
append_md ""

for table in "${KEY_TABLES[@]}"; do
  log "PITR check: ${table}"
  if ! DESC="$(aws dynamodb describe-continuous-backups --table-name "$table" 2>&1)"; then
    if echo "$DESC" | grep -qi 'ResourceNotFoundException\|not found\|Cannot do operations'; then
      append_md "- \`${table}\`: **MISSING** (warning — table absent in this account/stage)"
      WARNINGS=$((WARNINGS + 1))
      log "Table missing: ${table}"
      continue
    fi
    append_md "- \`${table}\`: **FAIL** describe-continuous-backups — \`${DESC//$'\n'/ }\`"
    CRITICAL_FAILS=$((CRITICAL_FAILS + 1))
    log "CRITICAL: describe failed for ${table}"
    continue
  fi

  STATUS="$(printf '%s' "$DESC" | python3 -c '
import json,sys
d=json.load(sys.stdin)
print(d.get("ContinuousBackupsDescription",{}).get("PointInTimeRecoveryDescription",{}).get("PointInTimeRecoveryStatus","UNKNOWN"))
' 2>/dev/null || echo UNKNOWN)"

  if [[ "$STATUS" == "ENABLED" ]]; then
    append_md "- \`${table}\`: PITR **ENABLED**"
  else
    append_md "- \`${table}\`: PITR **${STATUS}** (expected ENABLED) — **FAIL**"
    CRITICAL_FAILS=$((CRITICAL_FAILS + 1))
    log "CRITICAL: PITR ${STATUS} on ${table}"
  fi
done

append_md ""
append_md "## CloudTrail"
append_md ""

log "CloudTrail status…"
if TRAILS_JSON="$(aws cloudtrail describe-trails --include-shadow-trails 2>&1)"; then
  TRAIL_COUNT="$(printf '%s' "$TRAILS_JSON" | python3 -c 'import json,sys; print(len(json.load(sys.stdin).get("trailList",[])))' 2>/dev/null || echo 0)"
  append_md "- Trails returned by \`describe-trails\`: **${TRAIL_COUNT}**"
  if [[ "$TRAIL_COUNT" == "0" ]]; then
    append_md "- **FAIL** — no trails configured in this region/account view"
    CRITICAL_FAILS=$((CRITICAL_FAILS + 1))
  else
    # Prefer an organization or multi-region trail that is logging
    LOGGING_OK=0
    while IFS= read -r name; do
      [[ -z "$name" ]] && continue
      if STATUS_JSON="$(aws cloudtrail get-trail-status --name "$name" 2>/dev/null)"; then
        IS_LOGGING="$(printf '%s' "$STATUS_JSON" | python3 -c 'import json,sys; print(json.load(sys.stdin).get("IsLogging", False))' 2>/dev/null || echo False)"
        append_md "- Trail \`${name}\`: IsLogging=**${IS_LOGGING}**"
        if [[ "$IS_LOGGING" == "True" ]]; then
          LOGGING_OK=1
        fi
      else
        append_md "- Trail \`${name}\`: could not get-trail-status (warning)"
        WARNINGS=$((WARNINGS + 1))
      fi
    done < <(printf '%s' "$TRAILS_JSON" | python3 -c 'import json,sys
for t in json.load(sys.stdin).get("trailList",[]):
  print(t.get("Name") or t.get("TrailARN",""))
' 2>/dev/null || true)

    if [[ "$LOGGING_OK" -eq 0 ]]; then
      append_md "- **FAIL** — no trail with IsLogging=True"
      CRITICAL_FAILS=$((CRITICAL_FAILS + 1))
    fi
  fi
else
  append_md "- **FAIL** — describe-trails: \`${TRAILS_JSON//$'\n'/ }\`"
  CRITICAL_FAILS=$((CRITICAL_FAILS + 1))
fi

append_md ""
append_md "## Soft delete / restore drill"
append_md ""

if [[ "$SAFE_DR_DESTRUCTIVE" != "1" ]]; then
  append_md "- Skipped (set \`SAFE_DR_DESTRUCTIVE=1\` to enable)."
  append_md "- Destructive path would: create a disposable marker item in a **non-production** scratch table or invoke \`scripts/soc2-restore-drill.sh\` with \`DRY_RUN=0\` under change control — never in-place restore onto primary table names."
  log "Destructive DR steps skipped (SAFE_DR_DESTRUCTIVE!=1)"
else
  if [[ "$STAGE" == "prod" || "$STAGE" == "dev" ]]; then
    append_md "- **REFUSED** — SAFE_DR_DESTRUCTIVE=1 on stage \`${STAGE}\` (live-adjacent). Use staging/pilot scratch only."
    CRITICAL_FAILS=$((CRITICAL_FAILS + 1))
    log "REFUSED destructive DR on ${STAGE}"
  else
    SCRATCH="${PREFIX}-dr-scratch-${STAGE}"
    MARKER_PK="DR#TEST#${TIMESTAMP}"
    append_md "- Scratch table: \`${SCRATCH}\`"
    if aws dynamodb describe-table --table-name "$SCRATCH" >/dev/null 2>&1; then
      aws dynamodb put-item --table-name "$SCRATCH" \
        --item "{\"pk\":{\"S\":\"${MARKER_PK}\"},\"sk\":{\"S\":\"META\"},\"note\":{\"S\":\"dr-test soft marker\"}}" >/dev/null
      append_md "- Put marker \`${MARKER_PK}\`"
      aws dynamodb delete-item --table-name "$SCRATCH" \
        --key "{\"pk\":{\"S\":\"${MARKER_PK}\"},\"sk\":{\"S\":\"META\"}}" >/dev/null
      append_md "- Soft-deleted marker (delete-item)"
      append_md "- Restore: not automated here — use PITR restore-to-**new**-table via \`scripts/soc2-restore-drill.sh\` if validating backups"
      log "Soft delete marker cycle completed on ${SCRATCH}"
    else
      append_md "- Scratch table missing — create \`${SCRATCH}\` (pk/sk) in staging before destructive DR, or run \`soc2-restore-drill.sh\` against an existing table with DRY_RUN=0 + TICKET"
      WARNINGS=$((WARNINGS + 1))
    fi
  fi
fi

append_md ""
append_md "## Result"
append_md ""
append_md "- Critical failures: **${CRITICAL_FAILS}**"
append_md "- Warnings: **${WARNINGS}**"
append_md "- AWS reachable: **${AWS_REACHABLE}**"

if [[ "$CRITICAL_FAILS" -gt 0 ]]; then
  append_md ""
  append_md "**FAIL** — investigate PITR / CloudTrail before relying on this stage for DR."
  log "DR test FAILED (${CRITICAL_FAILS} critical)"
  echo "Report: $REPORT"
  exit 1
fi

append_md ""
append_md "**PASS** — critical DR readiness checks succeeded."
log "DR test PASSED"
echo "Report: $REPORT"
exit 0
