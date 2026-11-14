#!/usr/bin/env bash
# Run cad_writeback_e2e against staging with synthetic / pilot tokens.
# Fails closed when tokens are missing — never treats SKIP_DISABLED as pass.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck disable=SC1091
source "${ROOT}/scripts/env-api-staging.sh"

export PILOT_CAD_WRITEBACK_E2E=1
unset PILOT_ALLOW_SKIP_DISABLED || true

: "${PILOT_API_BASE:?Set PILOT_API_BASE to the staging API base URL}"
: "${PILOT_DISPATCHER_BEARER_TOKEN:?Mint a dispatcher JWT for staging}"
: "${PILOT_SUPERVISOR_BEARER_TOKEN:?Mint a distinct supervisor JWT for staging}"
: "${PILOT_WRITEBACK_INCIDENT_ID:?Provide a synthetic staging incidentId with a CAD counterpart}"

# Staging keeps CAD_WRITEBACK_ENABLED=false in env-api-staging.sh by default.
# For this e2e only, require an explicit opt-in so we never open write-back globally.
if [[ "${ALLOW_STAGING_CAD_WRITEBACK_E2E:-0}" != "1" ]]; then
  echo "Refusing: set ALLOW_STAGING_CAD_WRITEBACK_E2E=1 after enabling CAD_WRITEBACK_ENABLED on staging Lambdas for the pilot agency." >&2
  exit 1
fi

cd "${ROOT}"
npx tsx scripts/pilot-smoke-test.ts --only cad_writeback_e2e
