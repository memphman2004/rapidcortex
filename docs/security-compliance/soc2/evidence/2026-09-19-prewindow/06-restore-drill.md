# 5b. Restore drill — DRY_RUN — 2026-09-19

**SOP:** [restore-drill.md](../../processes/restore-drill.md)  
**Ticket:** `soc2-restore-20260919` (in-repo; no AWS change)  
**DRY_RUN:** yes  
**Source table (planned):** `rapid-cortex-audit-dev`  
**Restore table name (planned, not created):** `rapid-cortex-audit-dev-restore-20260919`

## What ran

```text
# Intended:
DRY_RUN=1 AWS_PROFILE=rapid-cortex AWS_DEFAULT_REGION=us-east-1 \
  bash scripts/soc2-restore-drill.sh rapid-cortex-audit-dev
```

`aws` is not installed in this environment, so the script exited before `describe-continuous-backups`. Compensating evidence: Track 1 file `dynamodb-pitr-post-fix.tsv` — **182/182 ENABLED**, including audit and incident/transcript tables.

Integrity hash of that TSV is in [hashes.sha256](../../../../evidence/soc2-evidence/2026-09-prewindow/hashes.sha256) (`8a83f41b…`).

## Validation performed (from TSV, not live describe)

1. All NexCort iQ/Ring tables in the inventory are `ENABLED` for PITR.
2. Restore target is a **new** name; in-place restore is refused by `scripts/soc2-restore-drill.sh`.
3. Production Lambda pointer would **not** change (drill rule).

## What did **not** run

`restore-table-to-point-in-time` (requires `DRY_RUN=0`, `TICKET=…`, and AWS). Do this on a NexCort iQ laptop before 2026-09-30:

```bash
DRY_RUN=0 TICKET=soc2-restore-20260930 AWS_PROFILE=rapid-cortex \
  bash scripts/soc2-restore-drill.sh rapid-cortex-audit-dev
```

Then `describe-table` until ACTIVE, compare item counts, **delete the restore table** after the log is filed. Never cut over.

## Result

**DRY_RUN complete.** Live restore remains **SOC-106 open**.

Ledger: [restore-drill-log.md](../restore-drill-log.md)
