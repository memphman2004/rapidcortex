#!/usr/bin/env bash
# Verify the in-repo SOC 2 documentation pack is complete (no AWS required).
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
fail=0
need() {
  if [[ ! -f "$ROOT/$1" ]]; then
    echo "MISSING $1" >&2
    fail=1
  fi
}

need docs/security-compliance/soc2/README.md
need docs/security-compliance/soc2/SYSTEM-BOUNDARY.md
need docs/security-compliance/soc2/CONTROL-MATRIX.md
need docs/security-compliance/soc2/OBSERVATION-WINDOW.md
need docs/security-compliance/soc2/OUT-OF-BAND.md
for n in 01-information-security-policy 02-code-of-conduct 03-access-control-policy \
  04-change-management-policy 05-vendor-management-policy 06-risk-assessment-policy \
  07-incident-response-policy 08-business-continuity-policy 09-data-classification-retention \
  10-logging-monitoring-policy 11-secure-development-policy 12-hr-security-awareness; do
  need "docs/security-compliance/soc2/policies/${n}.md"
done
for n in access-review change-management vendor-management incident-response-tabletop \
  restore-drill hr-onboarding-offboarding evidence-collection risk-assessment secrets-rotation; do
  need "docs/security-compliance/soc2/processes/${n}.md"
done
need docs/security-compliance/soc2/evidence/risk-register.md
need docs/evidence/templates/soc2/README.md
need scripts/lib/soc2-live-production-overrides.sh
need scripts/soc2-observation-pack.sh
need scripts/soc2-access-review.sh
need scripts/soc2-restore-drill.sh

# Claim hygiene: hub must forbid Type II marketing language.
if ! grep -q "Not a SOC 2 Type I or Type II report" "$ROOT/docs/security-compliance/soc2/README.md"; then
  echo "README missing Type II disclaimer" >&2
  fail=1
fi
if ! grep -q "rapid-cortex-cloudtrail-prod" "$ROOT/docs/security-compliance/soc2/SYSTEM-BOUNDARY.md"; then
  echo "SYSTEM-BOUNDARY missing Option B trail name" >&2
  fail=1
fi

if [[ "$fail" -ne 0 ]]; then
  echo "soc2-docs-check FAILED" >&2
  exit 1
fi
echo "soc2-docs-check OK"
