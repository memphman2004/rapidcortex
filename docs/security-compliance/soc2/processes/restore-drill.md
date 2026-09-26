# SOP — DynamoDB restore drill

**TSC:** CC7.5  
**Policy:** [POL-08](../policies/08-business-continuity-policy.md)  
**Cadence:** Once before 2026-10-01; at least annually

Production PITR is **ENABLED** on NexCort iQ/Ring tables. This SOP proves we can restore **without** overwriting live tables.

## Rules

- Default: `DRY_RUN=1` (describe PITR window only).
- Live restore: **new table name only**, e.g. `rapid-cortex-audit-dev-restore-YYYYMMDD`.
- Never `restore-table-to-point-in-time` onto the production table name.
- Never delete the restored table until the drill log is filed (then delete the **restore** table after validation to control cost).
- Pick a **non-customer-critical** table first (`audit` is preferred over live incident tables). If audit restore is too large, use a small feature table.

## Commands

```bash
# Describe only
DRY_RUN=1 AWS_PROFILE=rapid-cortex AWS_DEFAULT_REGION=us-east-1 \
  bash scripts/soc2-restore-drill.sh rapid-cortex-audit-dev

# Restore to a new table (requires change ticket)
DRY_RUN=0 TICKET=soc2-restore-YYYYMMDD AWS_PROFILE=rapid-cortex \
  bash scripts/soc2-restore-drill.sh rapid-cortex-audit-dev
```

## Validate

1. `describe-table` on the restore name — status ACTIVE.
2. Item count vs source (approx).
3. One `agencyId`-scoped query if the table uses that key.
4. Do **not** point Lambda env at the restore table in this drill unless it is a staged cutover under POL-04.

## Evidence

CLI output under `docs/evidence/soc2-evidence/YYYY-MM/restore-drill/` (no item payloads with transcripts) + [restore-drill-log.md](../evidence/restore-drill-log.md).
