#!/usr/bin/env bash
# G3 — Non-destructive repo + optional live checks (does not replace AWS console evidence).
# For WAF/CORS/encryption attachment, follow docs/security/g3-security-controls-platform.md
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "=========================================="
echo "G3: Security controls — repo + optional live probes"
echo "=========================================="

echo ""
echo "1) Secret pattern scan (repo)"
npm run security:scan-secrets

echo ""
echo "2) Square webhook signature unit tests"
npx vitest run apps/api/src/__tests__/square-webhook-signature.test.ts

echo ""
echo "3) Optional: npm run security:g3 (needs BASE_URL in env)"
if [[ -n "${BASE_URL:-}" ]] || [[ -n "${G3_API_BASE:-}" ]]; then
  npm run security:g3
else
  echo "   Skipped — set BASE_URL to run live G3 smoke probes."
fi

echo ""
echo "=========================================="
echo "G3 script complete. Attach AWS/console proof per gate sheet; do not infer GREEN from this run alone."
echo "=========================================="
