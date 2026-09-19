# Restore drill log

**SOP:** [restore-drill.md](../processes/restore-drill.md)

| Date (UTC) | Source table | Restore table name | DRY_RUN? | Ticket | Item-count check | Cut over? (must be no for drill) | Evidence path |
|------------|--------------|--------------------|----------|--------|------------------|----------------------------------|---------------|
| 2026-09-19 | `rapid-cortex-audit-dev` (planned) | `rapid-cortex-audit-dev-restore-20260919` (not created) | **yes** | soc2-restore-20260919 | 182/182 PITR ENABLED via TSV; live restore blocked (no AWS) | **no** | [06-restore-drill.md](./2026-09-19-prewindow/06-restore-drill.md) |
