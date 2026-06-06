#!/usr/bin/env bash
# Runs automated checks that support G1–G2 evidence collection.
# G3–G5 still require target-environment proof and human sign-off (see docs/customer-readiness-gate.md).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "=========================================="
echo "Rapid Cortex — automated readiness helpers"
echo "=========================================="
echo ""
echo "G1 — API security tests (Vitest, in-process)"
npm run test:security

echo ""
echo "G2 — CAD read-only adapter tests (Vitest)"
npx vitest run \
  apps/web/lib/rapid-cortex/cad/__tests__/adapter-integration.test.ts \
  apps/web/lib/rapid-cortex/cad/__tests__/staging-cad-read-adapter.test.ts

echo ""
echo "G3 — optional live probes (set BASE_URL; may WARN/FAIL without a deployment)"
set +e
npm run security:g3
g3=$?
set -e
if [[ "$g3" -ne 0 ]]; then
  echo "(security:g3 exited $g3 — expected if BASE_URL/TEST_JWT are unset)"
fi

echo ""
echo "------------------------------------------"
echo "Done. Automated suite finished."
echo "Next: fill docs/evidence/templates in the assessed environment; do not mark gates GREEN from repo-only runs."
echo "------------------------------------------"
