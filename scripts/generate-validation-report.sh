#!/bin/bash
set -euo pipefail

echo "Generating validation report..."

LATEST_LOG="$(ls -t validation-results-*.log 2>/dev/null | sed -n '1p')"
if [ -z "${LATEST_LOG:-}" ]; then
  LATEST_LOG="(no validation log found)"
fi

cat > VALIDATION_REPORT.md <<EOF
# System Validation Report

**Date:** $(date)
**Environment:** ${STAGE:-staging}
**Version:** $(git describe --tags --always 2>/dev/null || git rev-parse --short HEAD)
**Validation Log:** ${LATEST_LOG}

## Summary

- Build: \`npm run build\`
- Type Check: \`npm run typecheck\`
- Core Tests: \`npm run test\`
- Security Tests: \`npm run test:security\` (if configured)
- Validation Tests: \`npm run test:validation\`
- Smoke Tests: \`npm run smoke:api\` (if configured)
- CJIS Checks: gated by \`RUN_CJIS_CHECKS=true\`

## Component Coverage

- Core Platform (auth, tenancy, incident API surface)
- AI/Triage and Language feature API contracts
- CAD read-only gate and write-block verification
- RC Lite API auth/routing readiness checks
- Media and intake route contract checks
- Operational readiness checks (scripts/runbooks integration)

## Notes

- This report is generated from repository validation tooling and latest logs.
- Replace this section with signed evidence links from deployment and customer validation.

## Signoff

- Engineering Lead:
- Security Lead:
- Product Owner:
- Date:
EOF

echo "✅ Validation report generated: VALIDATION_REPORT.md"
