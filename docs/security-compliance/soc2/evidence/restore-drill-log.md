# Restore drill log

**SOP:** [restore-drill.md](../processes/restore-drill.md)

| Date (UTC) | Source table | Restore table name | DRY_RUN? | Ticket | Item-count check | Cut over? (must be no for drill) | Evidence path |
|------------|--------------|--------------------|----------|--------|------------------|----------------------------------|---------------|
| 2026-09-19 | `rapid-cortex-audit-dev` | `rapid-cortex-audit-dev-restore-20260919` | **no** (live restore) | soc2-restore-20260930 | Source DescribeTable 13218. Restore Scan COUNT **13218/13218**. DescribeTable ItemCount 0 on copy (stale). Copy deleted (`DELETING`). Cut over **no**. | **no** | [07-live-mac-mini.md](./2026-09-19-prewindow/07-live-mac-mini.md) |
