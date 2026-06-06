#!/bin/bash
set -euo pipefail

echo "========================================="
echo "COMPREHENSIVE SYSTEM VALIDATION"
echo "========================================="
echo "Date: $(date)"
echo "Environment: ${STAGE:-staging}"
echo ""

LOG_FILE="validation-results-$(date +%Y%m%d-%H%M%S).log"

run_if_script_exists() {
  local script_name="$1"
  if npm run | rg -q "$script_name"; then
    npm run "$script_name"
  else
    echo "⚠️  Skipping missing script: $script_name"
  fi
}

{
  echo "VALIDATION START: $(date)"

  echo ""
  echo "=== PRE-VALIDATION ==="
  bash scripts/validation-checklist.sh

  echo ""
  echo "=== BUILD VERIFICATION ==="
  npm run build

  echo ""
  echo "=== TYPE CHECKING ==="
  npm run typecheck

  echo ""
  echo "=== UNIT / CORE TESTS ==="
  npm run test

  echo ""
  echo "=== SECURITY TESTS ==="
  run_if_script_exists "test:security"

  echo ""
  echo "=== VALIDATION TESTS ==="
  npm run test:validation

  echo ""
  echo "=== DEPLOYMENT SMOKE TESTS ==="
  run_if_script_exists "smoke:api"

  if [ "${RUN_CJIS_CHECKS:-false}" = "true" ]; then
    echo ""
    echo "=== CJIS COMPLIANCE CHECKS ==="
    if [ -f "cjis_application_audit.py" ]; then
      python3 cjis_application_audit.py --repo-root .
    else
      echo "⚠️  Missing cjis_application_audit.py"
    fi
    if [ -f "cjis_compliance_checker.py" ]; then
      python3 cjis_compliance_checker.py --environment "${STAGE:-staging}"
    else
      echo "⚠️  Missing cjis_compliance_checker.py"
    fi
  fi

  echo ""
  echo "VALIDATION END: $(date)"
  echo "========================================="
  echo "VALIDATION COMPLETE"
  echo "========================================="
  echo "Results saved to: $LOG_FILE"
} | tee "$LOG_FILE"

if rg -q "FAIL|❌" "$LOG_FILE"; then
  echo ""
  echo "⚠️  VALIDATION FAILED - See $LOG_FILE for details"
  exit 1
fi

echo ""
echo "✅ VALIDATION PASSED"
