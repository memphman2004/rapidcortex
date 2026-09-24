#!/usr/bin/env bash
# Readiness check for AWS End User Messaging SMS (`pinpoint-sms-voice-v2`).
# This is NOT classic Amazon Pinpoint (`aws pinpoint update-sms-channel`).
#
# Account 158961537080 / us-east-1 left SANDBOX on 2026-09-14. Production SMS
# still requires: ACCOUNT_TIER=PRODUCTION, TEXT spend cap enforced, and at least
# one ACTIVE origination number (10DLC / toll-free). AWS may approve a monthly
# max without applying it — this script fails if EnforcedLimit is still $1.
#
# Exit 0: checks passed for configured expectations.
# Exit 1: failure (AWS errors, missing expected resources, sandbox, or spend cap).
set -euo pipefail

REGION="${AWS_REGION:-}"
POOL_ID="${AWS_SMS_POOL_ID:-}"
CONFIG_SET="${AWS_SMS_CONFIGURATION_SET_NAME:-}"
EVENT_DEST_NAME="${AWS_SMS_EVENT_DESTINATION_NAME:-}"
# When set to 1, do not fail solely because ACCOUNT_TIER is SANDBOX.
ALLOW_SANDBOX="${AWS_SMS_CHECK_ALLOW_SANDBOX:-0}"
# Minimum enforced TEXT monthly spend (USD). AWS approval of MaxLimit does not
# always raise EnforcedLimit; $1 means messages will still be blocked.
MIN_TEXT_SPEND="${AWS_SMS_MIN_TEXT_SPEND_USD:-50}"
PROFILE_ARG=()

while [[ $# -gt 0 ]]; do
  case "$1" in
    --region) REGION="${2:-}"; shift 2 ;;
    --pool-id) POOL_ID="${2:-}"; shift 2 ;;
    --configuration-set) CONFIG_SET="${2:-}"; shift 2 ;;
    --event-destination-name) EVENT_DEST_NAME="${2:-}"; shift 2 ;;
    --allow-sandbox) ALLOW_SANDBOX=1; shift ;;
    --profile) PROFILE_ARG=(--profile "${2:-}"); shift 2 ;;
    -h|--help)
      echo "Usage: AWS_REGION=... [AWS_SMS_POOL_ID=...] [AWS_SMS_CONFIGURATION_SET_NAME=...] [AWS_SMS_EVENT_DESTINATION_NAME=...] $0"
      echo "  AWS_SMS_CHECK_ALLOW_SANDBOX=1     — do not treat sandbox tier as FAIL"
      echo "  AWS_SMS_MIN_TEXT_SPEND_USD=50     — fail if TEXT EnforcedLimit is below this (default 50)"
      exit 0
      ;;
    *) echo "Unknown arg: $1" >&2; exit 1 ;;
  esac
done

if [[ -n "${AWS_PROFILE:-}" && ${#PROFILE_ARG[@]} -eq 0 ]]; then
  PROFILE_ARG=(--profile "${AWS_PROFILE}")
fi

if [[ -z "$REGION" ]]; then
  echo "FAIL: AWS_REGION is required"
  exit 1
fi

if ! command -v aws &>/dev/null; then
  echo "FAIL: AWS CLI not installed"
  exit 1
fi

if ! aws "${PROFILE_ARG[@]}" sts get-caller-identity --region "$REGION" &>/dev/null; then
  echo "FAIL: AWS CLI not authenticated"
  exit 1
fi

PINPOINT=(aws pinpoint-sms-voice-v2 "${PROFILE_ARG[@]}" --region "$REGION")
FAIL=0

TIER="$("${PINPOINT[@]}" describe-account-attributes --no-paginate --output json \
  | python3 -c "import json,sys; j=json.load(sys.stdin); a=j.get('AccountAttributes')or[]; print(next((x.get('Value','')for x in a if x.get('Name')=='ACCOUNT_TIER'),'UNKNOWN').upper())" \
  || { echo "FAIL: describe-account-attributes failed"; exit 1; }
)"

echo "PASS: describe-account-attributes (tier=$TIER)"
if [[ "$TIER" == "SANDBOX" && "$ALLOW_SANDBOX" != "1" ]]; then
  echo "FAIL: account is in SANDBOX; production is recommended for unrestricted failover. Re-run with AWS_SMS_CHECK_ALLOW_SANDBOX=1 to ignore."
  FAIL=1
elif [[ "$TIER" == "PRODUCTION" ]]; then
  echo "PASS: account is PRODUCTION (sandbox destination restriction is lifted)"
fi

SPEND_JSON="$("${PINPOINT[@]}" describe-spend-limits --no-paginate --output json \
  || { echo "FAIL: describe-spend-limits failed"; exit 1; }
)"
set +e
python3 -c "
import json, sys
j = json.loads(sys.argv[1])
want = int(sys.argv[2])
rows = { (x.get('Name') or ''): x for x in (j.get('SpendLimits') or []) }
text = rows.get('TEXT_MESSAGE_MONTHLY_SPEND_LIMIT') or {}
enforced = int(text.get('EnforcedLimit') or 0)
max_lim = int(text.get('MaxLimit') or 0)
overridden = bool(text.get('Overridden'))
print(f'INFO: TEXT spend EnforcedLimit={enforced} MaxLimit={max_lim} Overridden={overridden}')
if enforced < want:
    print(f'FAIL: TEXT monthly spend cap is {enforced} (need >= {want}). AWS approved MaxLimit={max_lim} but EnforcedLimit is what actually sends. Set it with:')
    print('  aws pinpoint-sms-voice-v2 set-text-message-spend-limit-override --monthly-limit ' + str(max(want, max_lim)) + ' --region us-east-1')
    print('Do not use classic Pinpoint update-sms-channel — NexCort iQ uses End User Messaging (sms-voice v2).')
    sys.exit(2)
print(f'PASS: TEXT monthly spend cap is {enforced} (max {max_lim})')
" "$SPEND_JSON" "$MIN_TEXT_SPEND"
spend_rc=$?
set -e
if [[ "$spend_rc" -eq 2 ]]; then
  FAIL=1
elif [[ "$spend_rc" -ne 0 ]]; then
  echo "FAIL: spend-limit parse failed"
  exit 1
fi

PHONE_JSON="$("${PINPOINT[@]}" describe-phone-numbers --no-paginate --output json \
  || { echo "FAIL: describe-phone-numbers failed"; exit 1; }
)"
set +e
python3 -c "
import json, sys
j = json.loads(sys.argv[1])
nums = j.get('PhoneNumbers') or []
if not nums:
    print('FAIL: no origination phone numbers in this region')
    sys.exit(2)
print(f'PASS: {len(nums)} origination number(s)')
for n in nums:
    mps = ((n.get('MessagingLimits') or {}).get('RateLimits') or {}).get('SMS', '?')
    print(f\"  {n.get('PhoneNumber')} type={n.get('NumberType')} status={n.get('Status')} twoWay={n.get('TwoWayEnabled')} mps={mps}\")
" "$PHONE_JSON"
phone_rc=$?
set -e
if [[ "$phone_rc" -eq 2 ]]; then
  FAIL=1
elif [[ "$phone_rc" -ne 0 ]]; then
  echo "FAIL: phone-number parse failed"
  exit 1
fi

if [[ -n "$POOL_ID" ]]; then
  if "${PINPOINT[@]}" describe-pools --pool-ids "$POOL_ID" --no-paginate --output json \
    | python3 -c "import json,sys; j=json.load(sys.stdin); sys.exit(0 if (j.get('Pools')or[]) else 1)"; then
    echo "PASS: pool $POOL_ID exists"
  else
    echo "FAIL: pool $POOL_ID not found"
    FAIL=1
  fi
else
  echo "SKIP: AWS_SMS_POOL_ID not set (not checking pool)"
fi

if [[ -n "$CONFIG_SET" ]]; then
  if "${PINPOINT[@]}" describe-configuration-sets --configuration-set-names "$CONFIG_SET" --no-paginate --output json \
    | python3 -c "import json,sys; j=json.load(sys.stdin); sys.exit(0 if (j.get('ConfigurationSets')or[]) else 1)"; then
    echo "PASS: configuration set $CONFIG_SET exists"
  else
    echo "FAIL: configuration set $CONFIG_SET not found"
    FAIL=1
  fi
else
  echo "SKIP: AWS_SMS_CONFIGURATION_SET_NAME not set (not checking configuration set)"
fi

if [[ -n "$CONFIG_SET" && -n "$EVENT_DEST_NAME" ]]; then
  if "${PINPOINT[@]}" describe-configuration-sets --configuration-set-names "$CONFIG_SET" --no-paginate --output json \
    | python3 -c "import json,sys; w=sys.argv[1]; j=json.load(sys.stdin)
cs=(j.get('ConfigurationSets')or[{}])[0]
for ed in (cs.get('EventDestinations')or[]):
  if (ed.get('Name') or ed.get('EventDestinationName'))==w: sys.exit(0)
sys.exit(1)" "$EVENT_DEST_NAME"; then
    echo "PASS: event destination $EVENT_DEST_NAME on $CONFIG_SET"
  else
    echo "FAIL: event destination $EVENT_DEST_NAME not found on $CONFIG_SET"
    FAIL=1
  fi
else
  echo "SKIP: event destination check (set AWS_SMS_CONFIGURATION_SET_NAME and AWS_SMS_EVENT_DESTINATION_NAME)"
fi

if [[ "$FAIL" -ne 0 ]]; then
  echo "Overall: FAIL"
  exit 1
fi
echo "Overall: PASS"
exit 0
