#!/bin/bash
set -euo pipefail

echo "========================================="
echo "RAPID CORTEX VALIDATION CHECKLIST"
echo "========================================="
echo "Date: $(date)"
echo "Environment: ${STAGE:-staging}"
echo ""

NODE_VERSION="$(node --version)"
echo "Node.js: $NODE_VERSION"
if [[ ! "$NODE_VERSION" =~ ^v(18|20|22) ]]; then
  echo "❌ Node.js 18+ required"
  exit 1
fi
echo "✅ Node.js version OK"

NPM_VERSION="$(npm --version)"
echo "npm: $NPM_VERSION"
echo "✅ npm installed"

if command -v aws >/dev/null 2>&1; then
  AWS_VERSION="$(aws --version)"
  echo "AWS CLI: $AWS_VERSION"
  echo "✅ AWS CLI installed"
else
  echo "⚠️  AWS CLI not found (required for infrastructure/CJIS checks)"
fi

if command -v python3 >/dev/null 2>&1; then
  PYTHON_VERSION="$(python3 --version)"
  echo "Python: $PYTHON_VERSION"
  echo "✅ Python installed"
else
  echo "⚠️  Python not found (needed for optional CJIS scripts)"
fi

echo ""
echo "Checking recommended environment variables..."
RECOMMENDED_VARS=(
  "API_UPSTREAM_BASE"
  "NEXT_PUBLIC_API_URL"
  "AWS_REGION"
)

MISSING=()
for var in "${RECOMMENDED_VARS[@]}"; do
  if [ -z "${!var:-}" ]; then
    MISSING+=("$var")
    echo "⚠️  $var not set"
  else
    echo "✅ $var set"
  fi
done

if [ ${#MISSING[@]} -gt 0 ]; then
  echo ""
  echo "ℹ️  Missing recommended env vars: ${MISSING[*]}"
  echo "   Some runtime/API validations may be skipped."
fi

echo ""
echo "✅ Environment validation checklist complete"
