#!/usr/bin/env bash
# Validates deployment-readiness documentation presence and a few public-facing guardrails.
# Run: bash scripts/validate-docs-deployment-readiness.sh
# Or: npm run validate:docs-readiness
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

fail() {
  echo "validate-docs-deployment-readiness: FAIL: $*" >&2
  exit 1
}

pass() {
  echo "validate-docs-deployment-readiness: OK: $*"
}

[[ -f docs/DEPLOYMENT_READINESS_MAP.md ]] || fail "missing docs/DEPLOYMENT_READINESS_MAP.md"
[[ -f docs/NEXT_DEPLOY_BLOCKERS.md ]] || fail "missing docs/NEXT_DEPLOY_BLOCKERS.md"
[[ -f docs/ENVIRONMENT_READINESS_CHECKLIST.md ]] || fail "missing docs/ENVIRONMENT_READINESS_CHECKLIST.md"

grep -q "DEPLOYMENT_READINESS_MAP.md" docs/PRODUCTION_READINESS_AUDIT.md ||
  fail "docs/PRODUCTION_READINESS_AUDIT.md must link DEPLOYMENT_READINESS_MAP.md"
grep -q "NEXT_DEPLOY_BLOCKERS.md" docs/PRODUCTION_READINESS_AUDIT.md ||
  fail "docs/PRODUCTION_READINESS_AUDIT.md must link NEXT_DEPLOY_BLOCKERS.md"
grep -q "ENVIRONMENT_READINESS_CHECKLIST.md" docs/PRODUCTION_READINESS_AUDIT.md ||
  fail "docs/PRODUCTION_READINESS_AUDIT.md must link ENVIRONMENT_READINESS_CHECKLIST.md"

pass "readiness docs exist and audit links them"

# Public app: must not claim "CJIS certified" (aligned controls are documented elsewhere).
if grep -RIn --include="*.tsx" --include="*.ts" --include="*.mdx" "CJIS certified" apps/web/app apps/web/components 2>/dev/null | grep -q .; then
  fail "phrase 'CJIS certified' found under apps/web/app or apps/web/components"
fi
pass "no 'CJIS certified' in public app paths (app/components)"

# Public pricing module must not expose internal dollar amounts (quote-based public pricing).
if grep -E '\$[0-9]+' apps/web/lib/marketing/pricing-content.ts >/dev/null 2>&1; then
  fail "numeric dollar pattern found in apps/web/lib/marketing/pricing-content.ts"
fi
pass "no public \\$<digits> pattern in pricing-content.ts"

# Marketing pages: fail if we find a positive "Rapid Cortex replaces" CAD claim (negation uses "does not replace").
if grep -RIn --include="*.tsx" --include="*.ts" "Rapid Cortex replaces" apps/web/app/\(marketing\) 2>/dev/null | grep -q .; then
  fail "found 'Rapid Cortex replaces' in marketing app — verify CAD positioning copy"
fi
pass "no bare 'Rapid Cortex replaces' string in marketing routes"

echo "validate-docs-deployment-readiness: all checks passed"
