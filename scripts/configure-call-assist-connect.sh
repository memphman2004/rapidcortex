#!/usr/bin/env bash
# MANUAL EXAMPLE — used for first-tenant Connect wiring.
# Production onboarding uses POST /api/call-assist/onboarding (then POST .../did).
# This script was used for KCPD manual onboarding and still defaults LEX_BOT_ID to that
# first-tenant bot. Set LEX_BOT_ID / LEX_BOT_ALIAS_ID / CALL_ASSIST_AGENCY_ID for agency #2+.
#
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
#   PHONE_NUMBER_PREFIX   optional NPA (e.g. +1816 for first-tenant KC). Empty = any US DID.
#   CALL_ASSIST_AGENCY_ID first-tenant default kcpd; set this for agency #2+
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
EMERGENCY_QUEUE_NAME="${CONNECT_EMERGENCY_QUEUE_NAME:-Call Assist Emergency}"
BOT_ALIAS_ARN="arn:aws:lex:${REGION}:${ACCOUNT}:bot-alias/${LEX_BOT_ID:-IJIBJOJG2L}/${LEX_BOT_ALIAS_ID:-0CNPVSCF4V}"
LAMBDAS=(
  "arn:aws:lambda:${REGION}:${ACCOUNT}:function:rapid-cortex-lex-dialog-hook-${STAGE}"
  "arn:aws:lambda:${REGION}:${ACCOUNT}:function:rapid-cortex-lex-fulfillment-hook-${STAGE}"
  "arn:aws:lambda:${REGION}:${ACCOUNT}:function:rapid-cortex-lex-agency-for-number-${STAGE}"
)
CLAIM_DID="${CLAIM_DID:-1}"
PHONE_NUMBER_PREFIX="${PHONE_NUMBER_PREFIX:-}"
CALL_ASSIST_AGENCY_ID="${CALL_ASSIST_AGENCY_ID:-kcpd}"

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

EMERGENCY_QUEUE_ID="$(aws_ok connect list-queues --instance-id "${INSTANCE_ID}" --queue-types STANDARD \
  --query "QueueSummaryList[?Name==\`${EMERGENCY_QUEUE_NAME}\`].Id | [0]" --output text)"
if [[ -z "${EMERGENCY_QUEUE_ID}" || "${EMERGENCY_QUEUE_ID}" == "None" ]]; then
  echo "→ Creating queue ${EMERGENCY_QUEUE_NAME}"
  EMERGENCY_QUEUE_ID="$(aws_ok connect create-queue \
    --instance-id "${INSTANCE_ID}" \
    --name "${EMERGENCY_QUEUE_NAME}" \
    --description "Call Assist emergency transfer target for live DID tests. Not a PSAP 911 queue." \
    --hours-of-operation-id "${HOURS_ID}" \
    --query 'QueueId' --output text)"
fi
EMERGENCY_QUEUE_ARN="arn:aws:connect:${REGION}:${ACCOUNT}:instance/${INSTANCE_ID}/queue/${EMERGENCY_QUEUE_ID}"
echo "   emergencyQueue=${EMERGENCY_QUEUE_NAME} ${EMERGENCY_QUEUE_ID}"

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
python3 - "${FLOW_SRC}" "${FLOW_TMP}" "${QUEUE_ARN}" "${BOT_ALIAS_ARN}" "${EMERGENCY_QUEUE_ARN}" <<'PY'
import json, sys
src, dest, queue_arn, bot_alias_arn, emergency_queue_arn = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4], sys.argv[5]
raw = (
    open(src, encoding="utf-8")
    .read()
    .replace("__DEMO_QUEUE_ARN__", queue_arn)
    .replace("__EMERGENCY_QUEUE_ARN__", emergency_queue_arn)
    .replace("{{lexBotAliasArn}}", bot_alias_arn)
)
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
elif [[ "${CLAIM_DID}" != "1" ]]; then
  echo "→ CLAIM_DID=0 and no claimed DID yet; skipping number claim."
else
  echo "→ Searching available US DIDs${PHONE_NUMBER_PREFIX:+ (prefix ${PHONE_NUMBER_PREFIX})}, never 911"
  CANDIDATE=""
  if [[ -n "${PHONE_NUMBER_PREFIX}" ]]; then
    CANDIDATE="$(aws_ok connect search-available-phone-numbers \
      --target-arn "${INSTANCE_ARN}" \
      --phone-number-country-code US \
      --phone-number-type DID \
      --phone-number-prefix "${PHONE_NUMBER_PREFIX}" \
      --max-results 5 \
      --query 'AvailableNumbersList[0].PhoneNumber' --output text 2>/dev/null || true)"
  fi
  if [[ -z "${CANDIDATE}" || "${CANDIDATE}" == "None" ]]; then
    echo "   searching any US DID"
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

if [[ -n "${PHONE_ID}" && "${PHONE_ID}" != "None" ]]; then
  echo "→ Assigning ${PHONE} to contact flow ${FLOW_NAME}"
  aws_ok connect associate-phone-number-contact-flow \
    --phone-number-id "${PHONE_ID}" \
    --instance-id "${INSTANCE_ID}" \
    --contact-flow-id "${FLOW_ID}"
fi

PROFILE_NAME="Call Assist Agent"
PROFILE_ID="$(aws_ok connect list-routing-profiles --instance-id "${INSTANCE_ID}" \
  --query "RoutingProfileSummaryList[?Name==\`${PROFILE_NAME}\`].Id | [0]" --output text)"
if [[ -z "${PROFILE_ID}" || "${PROFILE_ID}" == "None" ]]; then
  echo "→ Creating routing profile ${PROFILE_NAME}"
  PROFILE_ID="$(aws_ok connect create-routing-profile \
    --instance-id "${INSTANCE_ID}" \
    --name "${PROFILE_NAME}" \
    --description "CCP handoff for Demo Dispatcher and Call Assist Emergency" \
    --default-outbound-queue-id "${QUEUE_ID}" \
    --media-concurrencies "Channel=VOICE,Concurrency=1" \
    --queue-configs "QueueReference={QueueId=${QUEUE_ID},Channel=VOICE},Priority=2,Delay=0" \
                   "QueueReference={QueueId=${EMERGENCY_QUEUE_ID},Channel=VOICE},Priority=1,Delay=0" \
    --query 'RoutingProfileId' --output text)"
else
  echo "→ Updating routing profile queues ${PROFILE_NAME}"
  aws_ok connect update-routing-profile-queues \
    --instance-id "${INSTANCE_ID}" \
    --routing-profile-id "${PROFILE_ID}" \
    --queue-configs "QueueReference={QueueId=${QUEUE_ID},Channel=VOICE},Priority=2,Delay=0" \
                   "QueueReference={QueueId=${EMERGENCY_QUEUE_ID},Channel=VOICE},Priority=1,Delay=0" \
    >/dev/null || true
fi
echo "   routingProfile=${PROFILE_NAME} ${PROFILE_ID}"

AGENT_USERNAME="${CONNECT_AGENT_USERNAME:-callassist-agent}"
AGENT_SECURITY_ID="$(aws_ok connect list-security-profiles --instance-id "${INSTANCE_ID}" \
  --query 'SecurityProfileSummaryList[?Name==`Agent`].Id | [0]' --output text)"
EXISTING_USER="$(aws_ok connect list-users --instance-id "${INSTANCE_ID}" \
  --query "UserSummaryList[?Username==\`${AGENT_USERNAME}\`].Id | [0]" --output text)"
SECRET_NAME="rapid-cortex/${STAGE}/call-assist/connect-ccp-agent"
if [[ -z "${EXISTING_USER}" || "${EXISTING_USER}" == "None" ]]; then
  echo "→ Creating Connect CCP user ${AGENT_USERNAME}"
  AGENT_PASSWORD="$(python3 -c 'import secrets,string; alphabet=string.ascii_letters+string.digits; print("Aa1!"+"".join(secrets.choice(alphabet) for _ in range(16)))')"
  SECRET_JSON="$(U="${AGENT_USERNAME}" P="${AGENT_PASSWORD}" python3 -c 'import json,os; print(json.dumps({"username":os.environ["U"],"password":os.environ["P"],"ccp":"https://rapid-cortex.my.connect.aws/ccp-v2/"}))')"
  if aws_ok secretsmanager describe-secret --secret-id "${SECRET_NAME}" >/dev/null 2>&1; then
    aws_ok secretsmanager put-secret-value --secret-id "${SECRET_NAME}" --secret-string "${SECRET_JSON}" >/dev/null
  else
    aws_ok secretsmanager create-secret \
      --name "${SECRET_NAME}" \
      --description "Amazon Connect CCP agent for Call Assist live-phone tests. Not a 911 credential." \
      --secret-string "${SECRET_JSON}" >/dev/null
  fi
  aws_ok connect create-user \
    --instance-id "${INSTANCE_ID}" \
    --username "${AGENT_USERNAME}" \
    --password "${AGENT_PASSWORD}" \
    --identity-info FirstName=CallAssist,LastName=Agent \
    --phone-config PhoneType=SOFT_PHONE,AutoAccept=false,AfterContactWorkTimeLimit=30 \
    --security-profile-ids "${AGENT_SECURITY_ID}" \
    --routing-profile-id "${PROFILE_ID}" >/dev/null
  unset AGENT_PASSWORD SECRET_JSON
  echo "   CCP user created. Credentials: ${SECRET_NAME}"
else
  echo "→ Connect CCP user ${AGENT_USERNAME} already exists (${EXISTING_USER})"
  aws_ok connect update-user-routing-profile \
    --instance-id "${INSTANCE_ID}" \
    --user-id "${EXISTING_USER}" \
    --routing-profile-id "${PROFILE_ID}" >/dev/null || true
fi

echo "→ Updating DID lookup (CONFIG#tenant + __did_index__/PHONE#) to the claimed Connect number"
if [[ -n "${PHONE}" && "${PHONE}" != "None" ]]; then
  export AGENCY_ID="${CALL_ASSIST_AGENCY_ID}"
  export CALL_ASSIST_TEST_DID="${PHONE}"
  export KCPD_TEST_DID="${PHONE}"
  export LEX_BOT_ID="${LEX_BOT_ID:-IJIBJOJG2L}"
  export LEX_BOT_ALIAS_ID="${LEX_BOT_ALIAS_ID:-0CNPVSCF4V}"
  export CALL_ASSIST_TABLE="${CALL_ASSIST_TABLE:-rapid-cortex-call-assist-${STAGE}}"
  export CALL_ASSIST_SEED_PROFILE="${CALL_ASSIST_SEED_PROFILE:-kcpd}"
  bash "${ROOT}/scripts/seed-call-assist-tenant.sh"
fi

echo
echo "CONNECT_INSTANCE_ID=${INSTANCE_ID}"
echo "CONTACT_FLOW_ID=${FLOW_ID}"
echo "QUEUE_ID=${QUEUE_ID}"
echo "EMERGENCY_QUEUE_ID=${EMERGENCY_QUEUE_ID}"
echo "ROUTING_PROFILE_ID=${PROFILE_ID}"
echo "CLAIMED_DID=${PHONE:-none}"
echo "Language menu: 1 English, 2 Spanish, 3 Mandarin, 4 Cantonese, 5 Tagalog, 6 Vietnamese, 7 Arabic."
echo "Dial this number for live Call Assist tests. Do not hand it out as a 911 number."
exit 0
