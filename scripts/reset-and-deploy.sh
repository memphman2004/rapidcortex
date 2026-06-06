#!/usr/bin/env bash
# Full reset of local deps + SAM caches, then deploy dev with flat data layer (legacy dev stacks).
#
# Prerequisites:
#   cp .env.deploy.dev.example .env.deploy.dev   # then fill ARNs
#
# Usage: ./scripts/reset-and-deploy.sh
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

DEPLOY_ENV_FILE="${ROOT}/.env.deploy.dev"
if [[ ! -f "$DEPLOY_ENV_FILE" ]]; then
  echo "ERROR: Missing ${DEPLOY_ENV_FILE}" >&2
  echo "  cp ${ROOT}/.env.deploy.dev.example ${DEPLOY_ENV_FILE}" >&2
  echo "  # then set both FLAT_*_SECRET_ARN values" >&2
  exit 1
fi

set -a
# shellcheck disable=SC1090
source "$DEPLOY_ENV_FILE"
set +a

if [[ -z "${FLAT_DATA_LAYER_BILLING_PAYMENT_INSTRUCTIONS_SECRET_ARN:-}" ]] ||
  [[ -z "${FLAT_DATA_LAYER_BILLING_SES_CREDENTIALS_SECRET_ARN:-}" ]]; then
  echo "ERROR: ${DEPLOY_ENV_FILE} must define both billing secret ARNs (non-empty)." >&2
  exit 1
fi

echo "Stopping local SAM CLI processes (build/deploy)..."
# Match Homebrew/Python-wrapped SAM: command line contains "/sam build" or "/sam deploy".
pkill -TERM -u "$(id -u)" -f '/sam build ' 2>/dev/null || true
pkill -TERM -u "$(id -u)" -f '/sam deploy ' 2>/dev/null || true
sleep 2
pkill -KILL -u "$(id -u)" -f '/sam build ' 2>/dev/null || true
pkill -KILL -u "$(id -u)" -f '/sam deploy ' 2>/dev/null || true

echo "Cleaning SAM build directories..."
rm -rf "$HOME/.rapid-cortex-sam-build"
/bin/bash -c 'shopt -s nullglob 2>/dev/null || true; rm -rf /var/folders/*/T/rapid-cortex-sam-build.*' || true

echo "Removing node_modules (root + apps/api)..."
rm -rf "${ROOT}/node_modules" "${ROOT}/apps/api/node_modules"

echo "npm install at repo root (may take a while)..."
npm install

export SAM_BUILD_DIR="${HOME}/.rapid-cortex-sam-build"
mkdir -p "${SAM_BUILD_DIR}"

export INCLUDE_DATA_LAYER_NESTED_STACK=false
export ENABLE_CLOUD_TRAIL=false
# ARNs loaded from ${DEPLOY_ENV_FILE} above.

echo "SAM_BUILD_DIR=${SAM_BUILD_DIR}"
echo "SAM_BUILD_USE_CACHE=0 ./scripts/deploy.sh dev"
SAM_BUILD_USE_CACHE=0 ./scripts/deploy.sh dev
