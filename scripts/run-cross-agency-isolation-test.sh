#!/usr/bin/env bash
# Fetch Cognito JWTs for two test agencies and run the P0 isolation suite.
#
# Usage:
#   RC_TEST_PASSWORD='…' bash scripts/run-cross-agency-isolation-test.sh
#
# Optional overrides:
#   AGENCY_A_USER=dispatcher@appsondemand.net
#   AGENCY_B_USER=campusadmin@appsondemand.net
#   AGENCY_A_ID=test-agency
#   AGENCY_B_ID=test-campus-uga
#   AGENCY_A_ADMIN_USER=admin@appsondemand.net
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

REGION="${AWS_REGION:-us-east-1}"
PASSWORD="${RC_TEST_PASSWORD:?Set RC_TEST_PASSWORD (test Cognito user password)}"

AGENCY_A_USER="${AGENCY_A_USER:-dispatcher@appsondemand.net}"
AGENCY_B_USER="${AGENCY_B_USER:-campusadmin@appsondemand.net}"
AGENCY_A_ADMIN_USER="${AGENCY_A_ADMIN_USER:-admin@appsondemand.net}"
AGENCY_A_ID="${AGENCY_A_ID:-test-agency}"
AGENCY_B_ID="${AGENCY_B_ID:-test-campus-uga}"

# Source prod API bases if available
if [[ -f "${ROOT}/scripts/env-web-ssr-prod.sh" ]]; then
  # shellcheck source=scripts/env-web-ssr-prod.sh
  source "${ROOT}/scripts/env-web-ssr-prod.sh"
fi

export API_URL="${API_URL:-${API_UPSTREAM_BASE:-https://api.rapidcortex.us}}"
export API_URL_2="${API_URL_2:-${API_UPSTREAM_BASE_2:-https://t4bdwpjfs5.execute-api.us-east-1.amazonaws.com}}"
export API_URL_3="${API_URL_3:-${API_UPSTREAM_BASE_3:-https://tbr4zvjlk5.execute-api.us-east-1.amazonaws.com}}"
export API_URL_4="${API_URL_4:-${API_UPSTREAM_BASE_4:-https://7c70vqd1p5.execute-api.us-east-1.amazonaws.com}}"

if [[ -z "${COGNITO_CLIENT_ID:-}" ]]; then
  COGNITO_CLIENT_ID="$(aws cloudformation describe-stacks \
    --stack-name rapid-cortex-dev \
    --region "$REGION" \
    --query 'Stacks[0].Outputs[?OutputKey==`UserPoolClientId`].OutputValue' \
    --output text)"
fi

fetch_token() {
  local user="$1"
  aws cognito-idp initiate-auth \
    --region "$REGION" \
    --auth-flow USER_PASSWORD_AUTH \
    --client-id "$COGNITO_CLIENT_ID" \
    --auth-parameters "USERNAME=${user},PASSWORD=${PASSWORD}" \
    --query 'AuthenticationResult.IdToken' \
    --output text
}

echo "Fetching JWT for Agency A (${AGENCY_A_USER})…"
export AGENCY_A_JWT="$(fetch_token "$AGENCY_A_USER")"
echo "Fetching JWT for Agency B (${AGENCY_B_USER})…"
export AGENCY_B_JWT="$(fetch_token "$AGENCY_B_USER")"
echo "Fetching admin JWT for Agency A (${AGENCY_A_ADMIN_USER})…"
export AGENCY_A_ADMIN_JWT="$(fetch_token "$AGENCY_A_ADMIN_USER")"
export AGENCY_A_ID AGENCY_B_ID

LOG="/tmp/isolation-test-$(date +%Y%m%d-%H%M%S).log"
echo "Running isolation suite → ${LOG}"
npx tsx scripts/cross-agency-isolation-test.ts 2>&1 | tee "$LOG"
exit "${PIPESTATUS[0]}"
