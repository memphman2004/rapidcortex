#!/usr/bin/env bash
# Create (or rotate) the ChatGPT Watch → NexiQ Inbox ingest API key in Secrets Manager.
#
# Usage:
#   bash scripts/create-watch-ingest-secret.sh           # create if missing
#   bash scripts/create-watch-ingest-secret.sh --rotate  # put new key
#
# Prints the ARN and an export line for RAPID_IQ_WATCH_INGEST_API_KEY_SECRET_ARN.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck source=scripts/lib/rapid-cortex-aws.sh
source "${ROOT}/scripts/lib/rapid-cortex-aws.sh"

SECRET_NAME="${WATCH_INGEST_SECRET_NAME:-rapid-cortex/rapid-iq/watch-ingest-api-key}"
REGION="${AWS_REGION:-${RAPID_CORTEX_AWS_REGION:-us-east-1}}"
ROTATE=0
for arg in "$@"; do
  case "${arg}" in
  --rotate) ROTATE=1 ;;
  --help|-h)
    sed -n '2,12p' "$0"
    exit 0
    ;;
  esac
done

KEY="$(openssl rand -hex 32)"
PAYLOAD="$(printf '{"apiKey":"%s"}' "${KEY}")"

EXISTING_ARN="$(aws secretsmanager describe-secret \
  --region "${REGION}" \
  --secret-id "${SECRET_NAME}" \
  --query ARN \
  --output text 2>/dev/null || true)"

if [[ -z "${EXISTING_ARN}" || "${EXISTING_ARN}" == "None" ]]; then
  ARN="$(aws secretsmanager create-secret \
    --region "${REGION}" \
    --name "${SECRET_NAME}" \
    --description "NexCort iQ ChatGPT Watch → NexiQ Inbox ingest API key" \
    --secret-string "${PAYLOAD}" \
    --query ARN \
    --output text)"
  echo "Created secret: ${ARN}"
else
  ARN="${EXISTING_ARN}"
  if [[ "${ROTATE}" -eq 1 ]]; then
    aws secretsmanager put-secret-value \
      --region "${REGION}" \
      --secret-id "${SECRET_NAME}" \
      --secret-string "${PAYLOAD}" >/dev/null
    echo "Rotated secret: ${ARN}"
  else
    echo "Secret already exists: ${ARN}"
    echo "Re-run with --rotate to issue a new apiKey."
    KEY=""
  fi
fi

echo ""
echo "export RAPID_IQ_WATCH_INGEST_API_KEY_SECRET_ARN=${ARN}"
if [[ -n "${KEY}" ]]; then
  echo ""
  echo "Store this key in ChatGPT custom action headers (shown once):"
  echo "  x-nexcort-watch-key: ${KEY}"
fi
echo ""
echo "Then redeploy so SignalHttp picks up the ARN:"
echo "  source scripts/env-api-dev.sh && bash scripts/deploy.sh dev"
