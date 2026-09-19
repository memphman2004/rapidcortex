#!/usr/bin/env bash
# DynamoDB PITR restore drill helper.
# Default DRY_RUN=1 — describe PITR window only.
# Live restore always uses a NEW table name. Refuses to target the source name.
#
# Usage:
#   DRY_RUN=1 bash scripts/soc2-restore-drill.sh rapid-cortex-audit-dev
#   DRY_RUN=0 TICKET=soc2-restore-YYYYMMDD bash scripts/soc2-restore-drill.sh rapid-cortex-audit-dev
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

SOURCE="${1:-}"
DRY_RUN="${DRY_RUN:-1}"
TICKET="${TICKET:-}"
export AWS_PROFILE="${AWS_PROFILE:-rapid-cortex}"
export AWS_DEFAULT_REGION="${AWS_DEFAULT_REGION:-us-east-1}"
export AWS_REGION="${AWS_REGION:-$AWS_DEFAULT_REGION}"

STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
DAY="$(date -u +%Y%m%d)"
MONTH="$(date -u +%Y-%m)"
OUT="${SOC2_EVIDENCE_DIR:-$ROOT/docs/evidence/soc2-evidence/${MONTH}/restore-drill}"
mkdir -p "$OUT"

if [[ -z "$SOURCE" ]]; then
  echo "Usage: DRY_RUN=1 $0 <source-table-name>" >&2
  exit 2
fi

if [[ "$SOURCE" != rapid-cortex-* && "$SOURCE" != RapidCortex* && "$SOURCE" != Ring* ]]; then
  echo "ERROR: refusing table outside Rapid Cortex/Ring naming: $SOURCE" >&2
  exit 1
fi

RESTORE_NAME="${RESTORE_TABLE_NAME:-${SOURCE}-restore-${DAY}}"

if [[ "$RESTORE_NAME" == "$SOURCE" ]]; then
  echo "ERROR: restore table name must differ from source (refusing in-place restore)." >&2
  exit 1
fi

if ! command -v aws >/dev/null 2>&1; then
  echo "ERROR: aws CLI not found." >&2
  exit 1
fi

log() { printf '[%s] %s\n' "$(date -u +%H:%M:%S)" "$*"; }

log "Source=$SOURCE restore=$RESTORE_NAME DRY_RUN=$DRY_RUN ticket=${TICKET:-none}"

aws dynamodb describe-continuous-backups --table-name "$SOURCE" \
  | tee "$OUT/${STAMP}-describe-continuous-backups.json"

if [[ "$DRY_RUN" != "0" ]]; then
  log "DRY_RUN=1 — not calling restore-table-to-point-in-time."
  cat > "$OUT/${STAMP}-dry-run.md" <<EOF
# Restore drill dry-run ${STAMP}

- Source: \`${SOURCE}\`
- Would restore to: \`${RESTORE_NAME}\`
- Ticket: ${TICKET:-unset}

To execute (change control required):

\`\`\`bash
DRY_RUN=0 TICKET=${TICKET:-soc2-restore-${DAY}} bash scripts/soc2-restore-drill.sh ${SOURCE}
\`\`\`
EOF
  exit 0
fi

if [[ -z "$TICKET" ]]; then
  echo "ERROR: DRY_RUN=0 requires TICKET=... (change control)." >&2
  exit 1
fi

log "Restoring $SOURCE → $RESTORE_NAME (latest restorable time)"
aws dynamodb restore-table-to-point-in-time \
  --source-table-name "$SOURCE" \
  --target-table-name "$RESTORE_NAME" \
  --use-latest-restorable-time \
  | tee "$OUT/${STAMP}-restore-started.json"

log "Restore requested. Wait until ACTIVE, validate counts, do not cut over production. Log the drill."
