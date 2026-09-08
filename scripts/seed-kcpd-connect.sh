#!/usr/bin/env bash
# Wire the KCPD test DID to Call Assist tenant config (DynamoDB).
# Does not touch a live 911 PSAP number. Requires KCPD_TEST_DID (tenant test DID only).
#
# Usage:
#   source scripts/env-api-dev.sh
#   KCPD_TEST_DID=+1XXXXXXXXXX CALL_ASSIST_SEED_PROFILE=kcpd bash scripts/seed-kcpd-connect.sh
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

# shellcheck source=scripts/lib/rapid-cortex-aws.sh
source "${ROOT}/scripts/lib/rapid-cortex-aws.sh"
rapid_cortex_assert_aws_account

if [[ -z "${KCPD_TEST_DID:-}" ]]; then
  echo "ERROR: Set KCPD_TEST_DID to the tenant test DID (E.164). Never a live 911 number." >&2
  exit 1
fi

_did_digits="$(printf '%s' "${KCPD_TEST_DID}" | tr -cd '0-9')"
if [[ "${_did_digits}" == "911" || "${_did_digits}" == "1911" || "${KCPD_TEST_DID}" == *"911"* && ${#_did_digits} -le 4 ]]; then
  echo "ERROR: KCPD_TEST_DID must not be a live 911 number." >&2
  exit 1
fi
unset _did_digits

export CALL_ASSIST_TABLE="${CALL_ASSIST_TABLE:-rapid-cortex-call-assist-${1:-dev}}"
export KCPD_AGENCY_ID="${KCPD_AGENCY_ID:-kcpd}"
export CALL_ASSIST_SEED_PROFILE=kcpd

echo "→ Seeding KCPD Call Assist tenant ${KCPD_AGENCY_ID} on ${CALL_ASSIST_TABLE}"
echo "   testDID=${KCPD_TEST_DID}"
npx tsx "${ROOT}/scripts/seed-kcpd-connect.ts"
echo "→ Seed complete. GetAgencyConfigForNumber can resolve this DID."
