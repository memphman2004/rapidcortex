#!/usr/bin/env bash
# Validate multilingual secrets + LanguageSessions table for a stage (fail before pilot).
# Usage: AWS_PROFILE=rapid-cortex STAGE=dev bash scripts/validate-multilingual-stage.sh
set -euo pipefail

STAGE="${STAGE:-dev}"
REGION="${AWS_REGION:-us-east-1}"
PREFIX="${DYNAMO_TABLE_NAME_PREFIX:-rapid-cortex}"
TABLE="${LANGUAGE_SESSIONS_TABLE:-${PREFIX}-language-sessions-${STAGE}}"
# Prefer stack-wired secret names; keep legacy IDs as fallbacks.
AZURE_SECRET="${AZURE_SPEECH_KEY_SECRET_ID:-rapid-cortex/multilingual/azure-keys}"
AZURE_SECRET_LEGACY="${AZURE_SPEECH_KEY_SECRET_ID_LEGACY:-rapidcortex/${STAGE}/multilingual/azure-api}"
GOOGLE_SECRET="${GOOGLE_APPLICATION_CREDENTIALS_SECRET_ID:-rapid-cortex/multilingual/google-service-account}"
GOOGLE_SECRET_LEGACY="${GOOGLE_APPLICATION_CREDENTIALS_SECRET_ID_LEGACY:-rapidcortex/${STAGE}/multilingual/google-service-account}"
ROOT_STACK="${ROOT_STACK:-rapid-cortex-${STAGE}}"

echo "=== Multilingual stage validation ==="
echo "stage=${STAGE} region=${REGION}"
echo "table=${TABLE}"
echo ""

fail=0

echo "-- DynamoDB LanguageSessions --"
if aws dynamodb describe-table --table-name "${TABLE}" --region "${REGION}" \
  --query 'Table.[TableName,TableStatus]' --output text 2>/dev/null; then
  echo "OK table exists"
else
  echo "FAIL table missing: ${TABLE}"
  fail=1
fi

echo ""
echo "-- Secrets Manager (existence only; values not printed) --"
check_secret() {
  local sid="$1"
  if aws secretsmanager describe-secret --secret-id "${sid}" --region "${REGION}" \
    --query 'Name' --output text 2>/dev/null; then
    echo "OK secret ${sid}"
    return 0
  fi
  return 1
}
if ! check_secret "${AZURE_SECRET}"; then
  if ! check_secret "${AZURE_SECRET_LEGACY}"; then
    echo "WARN secret missing or inaccessible: ${AZURE_SECRET} (and legacy ${AZURE_SECRET_LEGACY}) — OK if stage uses mock STT"
  fi
fi
if ! check_secret "${GOOGLE_SECRET}"; then
  if ! check_secret "${GOOGLE_SECRET_LEGACY}"; then
    echo "WARN secret missing or inaccessible: ${GOOGLE_SECRET} (and legacy ${GOOGLE_SECRET_LEGACY}) — OK if stage uses mock translation"
  fi
fi

echo ""
echo "-- Sample language Lambda env (LANGUAGE_SESSIONS_TABLE / RC_RUNTIME_CONFIG_JSON.ls) --"
# Prefer StartLanguageSession; never pass a multi-line name list into get-function-configuration.
# list-functions can return several LanguageSession* names — pick Start* first.
FN="$(
  aws lambda list-functions --region "${REGION}" --output text \
    --query "Functions[?contains(FunctionName, 'LanguageSession')].FunctionName" 2>/dev/null \
    | tr '\t' '\n' \
    | awk '
        /StartLanguageSession/ { print; found=1; exit }
        NF && !picked { picked=$0 }
        END { if (!found && picked) print picked }
      '
)"
if [[ -n "${FN}" && "${FN}" != "None" ]]; then
  echo "function=${FN}"
  CFG="$(aws lambda get-function-configuration --function-name "${FN}" --region "${REGION}" \
    --query 'Environment.Variables' --output json 2>/dev/null || echo '{}')"
  if FN="${FN}" node -e '
    const fs=require("fs");
    const env=JSON.parse(fs.readFileSync(0,"utf8")||"{}");
    let ls=env.LANGUAGE_SESSIONS_TABLE||"";
    let packed=null;
    try { packed=JSON.parse(env.RC_RUNTIME_CONFIG_JSON||"null"); } catch {}
    if (!ls && packed && packed.ls) ls=packed.ls;
    console.log(JSON.stringify({
      function: process.env.FN||"",
      LANGUAGE_SESSIONS_TABLE: env.LANGUAGE_SESSIONS_TABLE||null,
      packed_ls: packed&&packed.ls||null,
      MULTILINGUAL_STRICT_VALIDATION: env.MULTILINGUAL_STRICT_VALIDATION||(packed&&packed.msv)||null,
      PRIMARY_STT_PROVIDER: env.PRIMARY_STT_PROVIDER||(packed&&packed.pst)||null,
      PRIMARY_TRANSLATION_PROVIDER: env.PRIMARY_TRANSLATION_PROVIDER||(packed&&packed.ptp)||null,
      LANGUAGE_PROVIDER: env.LANGUAGE_PROVIDER||(packed&&packed.lp)||null,
      resolved_ls: ls||null,
    },null,2));
    if (!ls) process.exit(2);
  ' <<<"${CFG}"; then
    echo "OK resolved LANGUAGE_SESSIONS_TABLE from Lambda env or packed JSON"
  else
    echo "FAIL LANGUAGE_SESSIONS_TABLE empty on ${FN} (top-level and RC_RUNTIME_CONFIG_JSON.ls) — language-session APIs will 503"
    fail=1
  fi
else
  echo "WARN no language Lambda found by name filter — check AppSam2 manually"
fi

echo ""
echo "-- CloudFormation Enable / multilingual params (root ${ROOT_STACK}) --"
aws cloudformation describe-stacks --stack-name "${ROOT_STACK}" --region "${REGION}" \
  --query 'Stacks[0].Parameters[?contains(ParameterKey, `Language`) || contains(ParameterKey, `Multilingual`) || contains(ParameterKey, `Azure`) || contains(ParameterKey, `Google`)].[ParameterKey,ParameterValue]' \
  --output table 2>/dev/null || echo "WARN could not read stack params"

echo ""
if [[ "${fail}" -ne 0 ]]; then
  echo "RESULT: FAIL — fix table/env before pilot (503 risk)"
  exit 1
fi
echo "RESULT: PASS (table + Lambda env present). Confirm Admin → Integrations multilingualIssueCount=0 with a live JWT."
exit 0
