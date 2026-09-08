#!/usr/bin/env bash
# First-tenant wrapper for KCPD. Prefer scripts/seed-call-assist-tenant.sh.
#
# Usage:
#   source scripts/env-api-dev.sh
#   KCPD_TEST_DID=+1XXXXXXXXXX CALL_ASSIST_SEED_PROFILE=kcpd bash scripts/seed-kcpd-connect.sh
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

export AGENCY_ID="${KCPD_AGENCY_ID:-kcpd}"
export CALL_ASSIST_TEST_DID="${KCPD_TEST_DID:-}"
export CALL_ASSIST_SEED_PROFILE="${CALL_ASSIST_SEED_PROFILE:-kcpd}"
export CALL_ASSIST_SEED_AGENCY_ID="${CALL_ASSIST_SEED_AGENCY_ID:-kcpd}"
bash "${ROOT}/scripts/seed-call-assist-tenant.sh" "${1:-dev}"
