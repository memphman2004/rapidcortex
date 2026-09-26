#!/usr/bin/env bash
# Put live Four Winds Interactive credentials into Secrets Manager and print
# the env exports needed to turn mock off on the next API deploy.
#
# Usage:
#   source scripts/env-api-dev.sh   # or staging
#   bash scripts/put-fourwinds-secret.sh \
#     --api-key 'VENDOR_KEY' \
#     --base-url 'https://api.fourwindsinteractive.com' \
#     [--client-id 'optional'] \
#     [--html5-fallback-base-url 'https://fallback.example.com']
#
# Never commit real keys. This script only writes to AWS Secrets Manager.

set -euo pipefail

STAGE="${STAGE:-${DEPLOYMENT_STAGE:-dev}}"
AWS_REGION="${AWS_REGION:-us-east-1}"
AWS_PROFILE="${AWS_PROFILE:-rapid-cortex}"
SECRET_ID="${FOURWINDS_SECRET_ID:-rapid-cortex/${STAGE}/integrations/fourwinds}"

API_KEY=""
CLIENT_ID=""
BASE_URL="https://api.fourwindsinteractive.com"
HTML5_FALLBACK=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --api-key) API_KEY="${2:-}"; shift 2 ;;
    --client-id) CLIENT_ID="${2:-}"; shift 2 ;;
    --base-url) BASE_URL="${2:-}"; shift 2 ;;
    --html5-fallback-base-url) HTML5_FALLBACK="${2:-}"; shift 2 ;;
    --secret-id) SECRET_ID="${2:-}"; shift 2 ;;
    -h|--help)
      sed -n '2,16p' "$0"
      exit 0
      ;;
    *)
      echo "Unknown arg: $1" >&2
      exit 1
      ;;
  esac
done

if [[ -z "${API_KEY}" ]]; then
  echo "ERROR: --api-key is required" >&2
  exit 1
fi
if [[ "${API_KEY}" == *"PLACEHOLDER"* ]] || [[ "${API_KEY}" == "changeme" ]]; then
  echo "ERROR: refuse to store a placeholder apiKey" >&2
  exit 1
fi

PAYLOAD="$(python3 - <<PY
import json
print(json.dumps({
  "apiKey": """${API_KEY}""",
  "clientId": """${CLIENT_ID}""",
  "baseUrl": """${BASE_URL}""",
  "html5FallbackBaseUrl": """${HTML5_FALLBACK}""",
}))
PY
)"

if aws secretsmanager describe-secret --secret-id "${SECRET_ID}" --region "${AWS_REGION}" --profile "${AWS_PROFILE}" >/dev/null 2>&1; then
  aws secretsmanager put-secret-value \
    --secret-id "${SECRET_ID}" \
    --secret-string "${PAYLOAD}" \
    --region "${AWS_REGION}" \
    --profile "${AWS_PROFILE}" >/dev/null
  echo "Updated secret: ${SECRET_ID}"
else
  ARN="$(aws secretsmanager create-secret \
    --name "${SECRET_ID}" \
    --description "Four Winds Interactive REST (SOC-024/025)" \
    --secret-string "${PAYLOAD}" \
    --region "${AWS_REGION}" \
    --profile "${AWS_PROFILE}" \
    --query ARN --output text)"
  echo "Created secret: ${ARN}"
fi

ARN="$(aws secretsmanager describe-secret --secret-id "${SECRET_ID}" --region "${AWS_REGION}" --profile "${AWS_PROFILE}" --query ARN --output text)"

cat <<EOF

Next (live mode):
  export EXISTING_FOURWINDS_SECRET_ARN=${ARN}
  export FOURWINDS_MOCK=false
  # then redeploy API so Lambdas pick up FourWindsMock=false

Smoke: dispatch an occupant alert (or ENS test) with DISPLAY_TAKEOVER and
confirm Four Winds receives activate + all-clear. If paths differ from
/api/v1/emergency/{active,clear}, update packages/integrations/src/fourwinds/client.ts.

EOF
