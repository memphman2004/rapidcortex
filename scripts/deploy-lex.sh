#!/usr/bin/env bash
# Deploy the standalone Call Assist Lex V2 stack (bot + dialog/fulfillment Lambdas).
# Does not update rapid-cortex-${STAGE} / stack-app-sam.yaml.
#
# Usage:
#   source scripts/env-api-dev.sh && bash scripts/deploy-lex.sh dev
#   LEX_LAMBDA_ONLY=1 bash scripts/deploy-lex.sh dev   # hooks only; DRAFT/alias unchanged
#   bash scripts/import-lex-bot-draft.sh dev           # 19-intent spec → DRAFT
#   bash scripts/publish-lex-alias.sh dev              # after TSTALIASID smoke tests
#
# Dev (DeploymentStage=dev) is the live account 158961537080.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

# shellcheck source=scripts/lib/rapid-cortex-aws.sh
source "${ROOT}/scripts/lib/rapid-cortex-aws.sh"

STAGE="${1:-dev}"
REGION="${AWS_REGION:-us-east-1}"
APP_NAME="${APP_NAME:-rapid-cortex}"
STACK="${LEX_STACK_NAME:-${APP_NAME}-lex-${STAGE}}"
TEMPLATE="infra/nested/stack-lex.yaml"
TABLE="${CALL_ASSIST_TABLE:-rapid-cortex-call-assist-${STAGE}}"

case "$STAGE" in
  dev | staging | prod | pilot) ;;
  *)
    echo "Usage: $0 [dev|staging|prod|pilot]" >&2
    exit 1
    ;;
esac

if [[ "$STAGE" == "dev" && "${I_UNDERSTAND_DEV_IS_PROD:-}" != "1" ]]; then
  echo "ERROR: deploy-lex.sh dev targets live production (account ${RAPID_CORTEX_AWS_ACCOUNT_ID})." >&2
  echo "  source scripts/env-api-dev.sh && bash scripts/deploy-lex.sh dev" >&2
  exit 1
fi

rapid_cortex_assert_aws_account

echo "→ Ensuring Lex V2 service-linked role exists…"
aws iam create-service-linked-role --aws-service-name lexv2.amazonaws.com >/dev/null 2>&1 || true

echo "→ Preflight lex:ListBots (required by AWS::Lex::Bot)…"
if ! aws lexv2-models list-bots --max-results 1 --region "${REGION}" >/dev/null; then
  echo "ERROR: lex:ListBots failed. The deploy role needs lex:ListBots on Resource * plus lex:CreateBot / iam:PassRole." >&2
  exit 1
fi

STACK_STATUS="$(aws cloudformation describe-stacks --stack-name "${STACK}" --region "${REGION}" --query 'Stacks[0].StackStatus' --output text 2>/dev/null || true)"
if [[ "${STACK_STATUS}" == "ROLLBACK_COMPLETE" || "${STACK_STATUS}" == "ROLLBACK_FAILED" || "${STACK_STATUS}" == "CREATE_FAILED" ]]; then
  echo "→ Deleting ${STACK} (${STACK_STATUS}) before recreate…"
  aws cloudformation delete-stack --stack-name "${STACK}" --region "${REGION}"
  aws cloudformation wait stack-delete-complete --stack-name "${STACK}" --region "${REGION}"
fi

echo "→ Validating ${TEMPLATE}…"
sam validate --lint --template "${TEMPLATE}" --region "${REGION}"

echo "→ Bundling Lex Lambda handlers (TypeScript → infra/lex-lambda)…"
npx esbuild "${ROOT}/apps/api/src/call-assist/lex/dialog-hook.ts" \
  --bundle --platform=node --target=node20 --format=cjs \
  --outfile="${ROOT}/infra/lex-lambda/dialog-hook.js" \
  --alias:rapid-cortex-shared="${ROOT}/packages/shared/src/index.ts" \
  --external:aws-sdk
npx esbuild "${ROOT}/apps/api/src/call-assist/lex/fulfillment-hook.ts" \
  --bundle --platform=node --target=node20 --format=cjs \
  --outfile="${ROOT}/infra/lex-lambda/fulfillment-hook.js" \
  --alias:rapid-cortex-shared="${ROOT}/packages/shared/src/index.ts" \
  --external:aws-sdk
npx esbuild "${ROOT}/apps/api/src/call-assist/lex/get-agency-for-number.ts" \
  --bundle --platform=node --target=node20 --format=cjs \
  --outfile="${ROOT}/infra/lex-lambda/get-agency-for-number.js" \
  --alias:rapid-cortex-shared="${ROOT}/packages/shared/src/index.ts" \
  --external:aws-sdk

if [[ "${LEX_LAMBDA_ONLY:-}" == "1" ]]; then
  echo "→ LEX_LAMBDA_ONLY=1 — updating hook function code only (DRAFT bot / live-dev alias unchanged)."
  ZIP="${ROOT}/infra/lex-lambda/.lex-hooks.zip"
  rm -f "${ZIP}"
  (cd "${ROOT}/infra/lex-lambda" && zip -q "${ZIP}" dialog-hook.js fulfillment-hook.js get-agency-for-number.js)
  for fn in dialog-hook fulfillment-hook agency-for-number; do
    name="${APP_NAME}-lex-${fn}-${STAGE}"
    echo "   update-function-code ${name}"
    aws lambda update-function-code --function-name "${name}" --zip-file "fileb://${ZIP}" --region "${REGION}" >/dev/null
  done
  echo "✅ Lex Lambdas updated. Intents stay on DRAFT until you deploy the bot or import infra/lex/bot-spec.json."
  echo "   Test DRAFT with alias TSTALIASID. Do not update live-${STAGE} until both locales pass RecognizeText."
  exit 0
fi

echo "→ Deploying Lex stack ${STACK} (${STAGE}, table ${TABLE})…"
echo "   WARNING: this publishes live-${STAGE} via AWS::Lex::BotVersion."
echo "   To update hooks only: LEX_LAMBDA_ONLY=1. To update DRAFT only: bash scripts/import-lex-bot-draft.sh ${STAGE}."
sam deploy \
  --template-file "${TEMPLATE}" \
  --stack-name "${STACK}" \
  --parameter-overrides \
    "AppName=${APP_NAME}" \
    "DeploymentStage=${STAGE}" \
    "CallAssistTableName=${TABLE}" \
  --capabilities CAPABILITY_IAM CAPABILITY_NAMED_IAM \
  --region "${REGION}" \
  --resolve-s3 \
  --no-fail-on-empty-changeset \
  --no-confirm-changeset

echo "→ Fetching outputs…"
BOT_ID="$(aws cloudformation describe-stacks \
  --stack-name "${STACK}" \
  --query 'Stacks[0].Outputs[?OutputKey==`BotId`].OutputValue' \
  --output text --region "${REGION}")"
ALIAS_ID="$(aws cloudformation describe-stacks \
  --stack-name "${STACK}" \
  --query 'Stacks[0].Outputs[?OutputKey==`BotAliasId`].OutputValue' \
  --output text --region "${REGION}")"
ALIAS_ARN="$(aws cloudformation describe-stacks \
  --stack-name "${STACK}" \
  --query 'Stacks[0].Outputs[?OutputKey==`BotAliasArn`].OutputValue' \
  --output text --region "${REGION}")"

echo ""
echo "✅ Lex bot deployed:"
echo "   Bot ID:        ${BOT_ID}"
echo "   Alias ID:      ${ALIAS_ID}"
echo "   Alias ARN:     ${ALIAS_ARN}"
echo "   Dialog hook:   ${APP_NAME}-lex-dialog-hook-${STAGE}"
echo "   Fulfillment:   ${APP_NAME}-lex-fulfillment-hook-${STAGE}"
echo "   DID lookup:    ${APP_NAME}-lex-agency-for-number-${STAGE}"
echo ""
echo "→ Next: import connect/contact-flow-call-assist.json into Amazon Connect"
echo "   and set LEX_BOT_ID=${BOT_ID} LEX_BOT_ALIAS_ID=${ALIAS_ID}"
echo "   Seed the tenant before test calls: AGENCY_ID=… CALL_ASSIST_TEST_DID=… bash scripts/seed-call-assist-tenant.sh"
echo "   First tenant (KCPD overlay): CALL_ASSIST_SEED_PROFILE=kcpd AGENCY_ID=kcpd"
