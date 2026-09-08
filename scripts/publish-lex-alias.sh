#!/usr/bin/env bash
# Snapshot DRAFT into a numbered version and point live-${STAGE} at it.
# Run only after RecognizeText on TSTALIASID passes for en_US and es_US.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck source=scripts/lib/rapid-cortex-aws.sh
source "${ROOT}/scripts/lib/rapid-cortex-aws.sh"

STAGE="${1:-dev}"
REGION="${AWS_REGION:-us-east-1}"
BOT_ID="${LEX_BOT_ID:-IJIBJOJG2L}"
ALIAS_ID="${LEX_BOT_ALIAS_ID:-0CNPVSCF4V}"

if [[ "$STAGE" == "dev" && "${I_UNDERSTAND_DEV_IS_PROD:-}" != "1" ]]; then
  echo "ERROR: source scripts/env-api-dev.sh first." >&2
  exit 1
fi
rapid_cortex_assert_aws_account

echo "→ Creating bot version from DRAFT…"
VERSION="$(aws lexv2-models create-bot-version \
  --bot-id "${BOT_ID}" \
  --bot-version-locale-specification '{
    "en_US": {"sourceBotVersion": "DRAFT"},
    "es_US": {"sourceBotVersion": "DRAFT"}
  }' \
  --description "Call Assist 19-intent spec" \
  --region "${REGION}" \
  --query 'botVersion' --output text)"

echo "   botVersion=${VERSION}"
echo "→ Waiting for version…"
for _ in $(seq 1 40); do
  ST="$(aws lexv2-models describe-bot-version --bot-id "${BOT_ID}" --bot-version "${VERSION}" --region "${REGION}" --query 'botStatus' --output text 2>/dev/null || echo Creating)"
  echo "   status=${ST}"
  if [[ "${ST}" == "Available" ]]; then
    break
  fi
  sleep 5
done

DIALOG_ARN="$(aws lambda get-function --function-name "rapid-cortex-lex-dialog-hook-${STAGE}" --query 'Configuration.FunctionArn' --output text --region "${REGION}")"

echo "→ Updating alias live-${STAGE} (${ALIAS_ID}) → version ${VERSION}…"
aws lexv2-models update-bot-alias \
  --bot-id "${BOT_ID}" \
  --bot-alias-id "${ALIAS_ID}" \
  --bot-alias-name "live-${STAGE}" \
  --bot-version "${VERSION}" \
  --bot-alias-locale-settings "{
    \"en_US\": {
      \"enabled\": true,
      \"codeHookSpecification\": {
        \"lambdaCodeHook\": {
          \"lambdaARN\": \"${DIALOG_ARN}\",
          \"codeHookInterfaceVersion\": \"1.0\"
        }
      }
    },
    \"es_US\": {
      \"enabled\": true,
      \"codeHookSpecification\": {
        \"lambdaCodeHook\": {
          \"lambdaARN\": \"${DIALOG_ARN}\",
          \"codeHookInterfaceVersion\": \"1.0\"
        }
      }
    }
  }" \
  --region "${REGION}" >/dev/null

echo "✅ live-${STAGE} now points at version ${VERSION}"
