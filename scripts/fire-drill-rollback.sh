#!/usr/bin/env bash
# G5 — Operational rollback drill *checklist* (no cloud side effects).
# Record timestamps, actor, and outcomes in docs/evidence/templates/g5-operational-safety-evidence.template.md
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "=========================================="
echo "G5: Rollback / kill-switch drill (checklist)"
echo "=========================================="
echo ""
echo "Execute in the target environment and attach logs to the G5 evidence template:"
echo "  1. Disable CAD / risky feature flags per runbook (time to disable: ___ s)."
echo "  2. Verify API /web health and representative dispatcher flows."
echo "  3. Confirm dashboards degrade gracefully (no unhandled crashes)."
echo "  4. Re-enable flags; verify recovery."
echo "  5. Export or screenshot audit events for the drill window."
echo ""
echo "Related docs: docs/customer-readiness-gate.md (G5), docs/security-ops-evidence-package.md"
echo "=========================================="
