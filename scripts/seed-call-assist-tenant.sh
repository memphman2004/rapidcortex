#!/usr/bin/env bash
# Wire a tenant test DID to Call Assist config (DynamoDB).
# Does not touch a live 911 PSAP number.
#
# Usage:
#   source scripts/env-api-dev.sh
#   AGENCY_ID=fulton-county CALL_ASSIST_TEST_DID=+1XXXXXXXXXX bash scripts/seed-call-assist-tenant.sh
#
# First tenant (KCPD overlay):
#   AGENCY_ID=kcpd CALL_ASSIST_SEED_PROFILE=kcpd CALL_ASSIST_TEST_DID=+1XXXXXXXXXX \
#     bash scripts/seed-call-assist-tenant.sh
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

# shellcheck source=scripts/lib/rapid-cortex-aws.sh
source "${ROOT}/scripts/lib/rapid-cortex-aws.sh"
rapid_cortex_assert_aws_account

TEST_DID="${CALL_ASSIST_TEST_DID:-${KCPD_TEST_DID:-}}"
if [[ -z "${TEST_DID}" ]]; then
  echo "ERROR: Set CALL_ASSIST_TEST_DID to the tenant test DID (E.164). Never a live 911 number." >&2
  exit 1
fi

_did_digits="$(printf '%s' "${TEST_DID}" | tr -cd '0-9')"
if [[ "${_did_digits}" == "911" || "${_did_digits}" == "1911" || "${TEST_DID}" == *"911"* && ${#_did_digits} -le 4 ]]; then
  echo "ERROR: CALL_ASSIST_TEST_DID must not be a live 911 number." >&2
  exit 1
fi
unset _did_digits

export AGENCY_ID="${AGENCY_ID:-${KCPD_AGENCY_ID:-}}"
if [[ -z "${AGENCY_ID}" ]]; then
  echo "ERROR: Set AGENCY_ID." >&2
  exit 1
fi
export CALL_ASSIST_TEST_DID="${TEST_DID}"
export CALL_ASSIST_TABLE="${CALL_ASSIST_TABLE:-rapid-cortex-call-assist-${1:-dev}}"

echo "→ Seeding Call Assist tenant ${AGENCY_ID} on ${CALL_ASSIST_TABLE}"
echo "   testDID=${CALL_ASSIST_TEST_DID}"
npx tsx "${ROOT}/scripts/seed-call-assist-tenant.ts"
echo "→ Seed complete. GetAgencyConfigForNumber can resolve this DID."
