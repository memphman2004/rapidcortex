#!/usr/bin/env bash
# Configure Amazon Connect for RC Call Assist (same order as the console runbook).
# Does not claim a DID until the flow is imported and all three Lambda associations exist.
#
# Usage:
#   source scripts/env-api-dev.sh
#   bash scripts/configure-call-assist-connect.sh
#
# Optional:
#   CONNECT_INSTANCE_ID   skip instance create/lookup
#   CONNECT_INSTANCE_ALIAS default rapid-cortex
#   CLAIM_DID=0           import + associate only (no phone number)
#   PHONE_NUMBER_PREFIX   default +1816 (Kansas City); falls back to any US DID
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck source=scripts/lib/rapid-cortex-aws.sh
source "${ROOT}/scripts/lib/rapid-cortex-aws.sh"
rapid_cortex_assert_aws_account

if [[ "${I_UNDERSTAND_DEV_IS_PROD:-}" != "1" ]]; then
  echo "ERROR: source scripts/env-api-dev.sh first (I_UNDERSTAND_DEV_IS_PROD=1)." >&2
  exit 1
fi

REGION="${AWS_REGION:-us-east-1}"
ACCOUNT="$(aws sts get-caller-identity --query Account --output text)"
STAGE="${1:-dev}"
ALIAS="${CONNECT_INSTANCE_ALIAS:-rapid-cortex}"
FLOW_NAME="Call Assist"
QUEUE_NAME="Demo Dispatcher"
BOT_ALIAS_ARN="arn:aws:lex:${REGION}:${ACCOUNT}:bot-alias/IJIBJOJG2L/0CNPVSCF4V"
LAMBDAS=(
  "arn:aws:lambda:${REGION}:${ACCOUNT}:function:rapid-cortex-lex-dialog-hook-${STAGE}"
  "arn:aws:lambda:${REGION}:${ACCOUNT}:function:rapid-cortex-lex-fulfillment-hook-${STAGE}"
  "arn:aws:lambda:${REGION}:${ACCOUNT}:function:rapid-cortex-lex-agency-for-number-${STAGE}"
)
CLAIM_DID="${CLAIM_DID:-1}"
PHONE_NUMBER_PREFIX="${PHONE_NUMBER_PREFIX:-+1816}"

aws_ok() {
  aws "$@" --region "${REGION}"
}

find_instance_id() {
  if [[ -n "${CONNECT_INSTANCE_ID:-}" ]]; then
    printf '%s' "${CONNECT_INSTANCE_ID}"
    return
  fi
  local rows id
  rows="$(aws_ok connect list-instances --query 'InstanceSummaryList[].{Id:Id,Alias:InstanceAlias,Status:InstanceStatus}' --output json)"
  id="$(python3 -c '
import json, os, sys
rows = json.loads(sys.argv[1])
alias = os.environ.get("CONNECT_INSTANCE_ALIAS", "rapid-cortex")
if not rows:
    raise SystemExit(0)
for row in rows:
    if (row.get("Alias") or "") == alias:
        print(row["Id"])
        raise SystemExit(0)
preferred = [r for r in rows if "cortex" in (r.get("Alias") or "").lower() or "rapid" in (r.get("Alias") or "").lower()]
pick = preferred[0] if preferred else rows[0]
print(pick["Id"])
' "${rows}")"
  printf '%s' "${id}"
}

wait_instance_active() {
  local iid="$1" status=""
  for _ in $(seq 1 60); do
    status="$(aws_ok connect describe-instance --instance-id "${iid}" --query 'Instance.InstanceStatus' --output text)"
    echo "   instance ${iid} status=${status}"
    if [[ "${status}" == "ACTIVE" ]]; then
      return 0
    fi
    if [[ "${status}" == "CREATION_FAILED" ]]; then
      echo "ERROR: Connect instance creation failed" >&2
      exit 1
    fi
    sleep 15
  done
  echo "ERROR: timed out waiting for Connect instance ACTIVE" >&2
  exit 1
}

echo "→ Amazon Connect Call Assist (${STAGE})"

INSTANCE_ID="$(find_instance_id || true)"
if [[ -z "${INSTANCE_ID}" ]]; then
  echo "→ No Connect instance found. Creating alias=${ALIAS} (inbound+outbound, CONNECT_MANAGED)"
  INSTANCE_ID="$(aws_ok connect create-instance \
    --identity-management-type CONNECT_MANAGED \
    --instance-alias "${ALIAS}" \
    --inbound-calls-enabled \
    --outbound-calls-enabled \
    --query 'Id' --output text)"
fi
wait_instance_active "${INSTANCE_ID}"
INSTANCE_ARN="arn:aws:connect:${REGION}:${ACCOUNT}:instance/${INSTANCE_ID}"
echo "   instanceId=${INSTANCE_ID}"

HOURS_ID="$(aws_ok connect list-hours-of-operations --instance-id "${INSTANCE_ID}" \
  --query 'HoursOfOperationSummaryList[?Name==`Basic Hours`].Id | [0]' --output text)"
if [[ -z "${HOURS_ID}" || "${HOURS_ID}" == "None" ]]; then
  HOURS_ID="$(aws_ok connect list-hours-of-operations --instance-id "${INSTANCE_ID}" \
    --query 'HoursOfOperationSummaryList[0].Id' --output text)"
fi
if [[ -z "${HOURS_ID}" || "${HOURS_ID}" == "None" ]]; then
  echo "ERROR: no hours of operation on instance ${INSTANCE_ID}" >&2
  exit 1
fi

QUEUE_ID="$(aws_ok connect list-queues --instance-id "${INSTANCE_ID}" --queue-types STANDARD \
  --query "QueueSummaryList[?Name==\`${QUEUE_NAME}\`].Id | [0]" --output text)"
if [[ -z "${QUEUE_ID}" || "${QUEUE_ID}" == "None" ]]; then
  echo "→ Creating queue ${QUEUE_NAME}"
  QUEUE_ID="$(aws_ok connect create-queue \
    --instance-id "${INSTANCE_ID}" \
    --name "${QUEUE_NAME}" \
    --description "Call Assist demo transfer target. Evaluators need not answer." \
    --hours-of-operation-id "${HOURS_ID}" \
    --query 'QueueId' --output text)"
fi
QUEUE_ARN="arn:aws:connect:${REGION}:${ACCOUNT}:instance/${INSTANCE_ID}/queue/${QUEUE_ID}"
echo "   queue=${QUEUE_NAME} ${QUEUE_ID}"

echo "→ Associating Lambdas (before flow import so CreateContactFlow can resolve ARNs)"
for arn in "${LAMBDAS[@]}"; do
  if aws_ok connect associate-lambda-function --instance-id "${INSTANCE_ID}" --function-arn "${arn}" 2>/dev/null; then
    echo "   associated ${arn##*:function:}"
  else
    echo "   already associated ${arn##*:function:}"
  fi
done

echo "→ Associating Lex V2 bot RCCallAssistBot-dev / live-dev"
if aws_ok connect associate-bot --instance-id "${INSTANCE_ID}" --lex-v2-bot "AliasArn=${BOT_ALIAS_ARN}" 2>/dev/null; then
  echo "   associated ${BOT_ALIAS_ARN}"
else
  echo "   Lex bot already associated or associate-bot returned a non-fatal error; verifying…"
fi

FLOW_SRC="${ROOT}/connect/contact-flow-call-assist.json"
FLOW_TMP="$(mktemp)"
python3 - "${FLOW_SRC}" "${FLOW_TMP}" "${QUEUE_ARN}" <<'PY'
import json, sys
src, dest, queue_arn = sys.argv[1], sys.argv[2], sys.argv[3]
raw = open(src, encoding="utf-8").read().replace("__DEMO_QUEUE_ARN__", queue_arn)
data = json.loads(raw)
open(dest, "w", encoding="utf-8").write(json.dumps(data, separators=(",", ":")))
PY

FLOW_ID="$(aws_ok connect list-contact-flows --instance-id "${INSTANCE_ID}" --contact-flow-types CONTACT_FLOW \
  --query "ContactFlowSummaryList[?Name==\`${FLOW_NAME}\`].Id | [0]" --output text)"
if [[ -z "${FLOW_ID}" || "${FLOW_ID}" == "None" ]]; then
  echo "→ Importing contact flow ${FLOW_NAME}"
  FLOW_ID="$(aws_ok connect create-contact-flow \
    --instance-id "${INSTANCE_ID}" \
    --name "${FLOW_NAME}" \
    --type CONTACT_FLOW \
    --description "RC Call Assist Lex V2 inbound. Test DID only." \
    --content "file://${FLOW_TMP}" \
    --query 'ContactFlowId' --output text)"
else
  echo "→ Updating contact flow ${FLOW_NAME}"
  aws_ok connect update-contact-flow-content \
    --instance-id "${INSTANCE_ID}" \
    --contact-flow-id "${FLOW_ID}" \
    --content "file://${FLOW_TMP}" >/dev/null
fi
rm -f "${FLOW_TMP}"
echo "   contactFlowId=${FLOW_ID}"

echo "→ Verifying Lambda associations (required before claiming a DID)"
ASSOCIATED="$(aws_ok connect list-lambda-functions --instance-id "${INSTANCE_ID}" --query 'LambdaFunctions' --output json)"
MISSING="$(python3 -c '
import json, sys
have = set(json.loads(sys.argv[1]))
need = sys.argv[2:]
missing = [n for n in need if n not in have]
print("\n".join(missing))
' "${ASSOCIATED}" "${LAMBDAS[@]}")"
if [[ -n "${MISSING}" ]]; then
  echo "ERROR: Lambda associations missing:" >&2
  echo "${MISSING}" >&2
  exit 1
fi
echo "   all three Lambdas associated"

BOTS="$(aws_ok connect list-bots --instance-id "${INSTANCE_ID}" --lex-version V2 --output json)"
python3 -c '
import json, sys
data = json.loads(sys.argv[1])
want_alias = "0CNPVSCF4V"
rows = data.get("LexBots") or data.get("LexV2Bots") or []
ok = False
for row in rows:
    bot = row.get("LexV2Bot") or row
    alias = bot.get("AliasId") or bot.get("AliasArn") or ""
    bot_id = bot.get("BotId") or ""
    if want_alias in str(alias) or bot_id == "IJIBJOJG2L":
        ok = True
print("lex_bot_associated" if ok else "lex_bot_not_listed_yet")
' "${BOTS}"

if [[ "${CLAIM_DID}" != "1" ]]; then
  echo "→ CLAIM_DID=0; skipping phone number. Assign the Call Assist flow after you claim a DID."
  echo "CONNECT_INSTANCE_ID=${INSTANCE_ID}"
  echo "CONTACT_FLOW_ID=${FLOW_ID}"
  echo "QUEUE_ID=${QUEUE_ID}"
  exit 0
fi

EXISTING_DID="$(aws_ok connect list-phone-numbers-v2 \
  --target-arn "${INSTANCE_ARN}" \
  --max-results 10 \
  --query 'ListPhoneNumbersSummaryList[0].PhoneNumber' --output text 2>/dev/null || true)"
PHONE=""
PHONE_ID=""
if [[ -n "${EXISTING_DID}" && "${EXISTING_DID}" != "None" ]]; then
  PHONE="${EXISTING_DID}"
  PHONE_ID="$(aws_ok connect list-phone-numbers-v2 --target-arn "${INSTANCE_ARN}" --max-results 10 \
    --query "ListPhoneNumbersSummaryList[?PhoneNumber==\`${PHONE}\`].PhoneNumberId | [0]" --output text)"
  echo "→ Reusing claimed DID ${PHONE}"
else
  echo "→ Searching available US DIDs (prefix ${PHONE_NUMBER_PREFIX}, never 911)"
  CANDIDATE="$(aws_ok connect search-available-phone-numbers \
    --target-arn "${INSTANCE_ARN}" \
    --phone-number-country-code US \
    --phone-number-type DID \
    --phone-number-prefix "${PHONE_NUMBER_PREFIX}" \
    --max-results 5 \
    --query 'AvailableNumbersList[0].PhoneNumber' --output text 2>/dev/null || true)"
  if [[ -z "${CANDIDATE}" || "${CANDIDATE}" == "None" ]]; then
    echo "   no ${PHONE_NUMBER_PREFIX} numbers; searching any US DID"
    CANDIDATE="$(aws_ok connect search-available-phone-numbers \
      --target-arn "${INSTANCE_ARN}" \
      --phone-number-country-code US \
      --phone-number-type DID \
      --max-results 5 \
      --query 'AvailableNumbersList[0].PhoneNumber' --output text)"
  fi
  if [[ -z "${CANDIDATE}" || "${CANDIDATE}" == "None" ]]; then
    echo "ERROR: no available US DID to claim" >&2
    exit 1
  fi
  DIGITS="$(printf '%s' "${CANDIDATE}" | tr -cd '0-9')"
  if [[ "${DIGITS}" == "911" || "${DIGITS}" == "1911" ]]; then
    echo "ERROR: refusing to claim a 911 number (${CANDIDATE})" >&2
    exit 1
  fi
  echo "→ Claiming ${CANDIDATE}"
  CLAIM_JSON="$(aws_ok connect claim-phone-number \
    --target-arn "${INSTANCE_ARN}" \
    --phone-number "${CANDIDATE}" \
    --phone-number-description "Call Assist demo test DID — not a live 911 number")"
  PHONE="${CANDIDATE}"
  PHONE_ID="$(python3 -c 'import json,sys; print(json.loads(sys.argv[1])["PhoneNumberId"])' "${CLAIM_JSON}")"
fi

echo "→ Assigning ${PHONE} to contact flow ${FLOW_NAME}"
aws_ok connect associate-phone-number-contact-flow \
  --phone-number-id "${PHONE_ID}" \
  --instance-id "${INSTANCE_ID}" \
  --contact-flow-id "${FLOW_ID}"

echo "→ Updating DID lookup (CONFIG#tenant + __did_index__/PHONE#) to the claimed Connect number"
export KCPD_TEST_DID="${PHONE}"
export LEX_BOT_ID="${LEX_BOT_ID:-IJIBJOJG2L}"
export LEX_BOT_ALIAS_ID="${LEX_BOT_ALIAS_ID:-0CNPVSCF4V}"
export CALL_ASSIST_TABLE="${CALL_ASSIST_TABLE:-rapid-cortex-call-assist-${STAGE}}"
export CALL_ASSIST_SEED_PROFILE=kcpd
bash "${ROOT}/scripts/seed-kcpd-connect.sh"

echo
echo "CONNECT_INSTANCE_ID=${INSTANCE_ID}"
echo "CONTACT_FLOW_ID=${FLOW_ID}"
echo "QUEUE_ID=${QUEUE_ID}"
echo "CLAIMED_DID=${PHONE}"
echo "Dial this number for the three smoke tests. Do not hand it out until those pass."
