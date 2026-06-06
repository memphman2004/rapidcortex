#!/usr/bin/env bash
# Readiness check for AWS SMS (End User Messaging) + optional resource presence.
# Exit 0: checks passed for configured expectations.
# Exit 1: failure (AWS errors, missing expected resources, or sandbox when not allowed).
set -euo pipefail

REGION="${AWS_REGION:-}"
POOL_ID="${AWS_SMS_POOL_ID:-}"
CONFIG_SET="${AWS_SMS_CONFIGURATION_SET_NAME:-}"
EVENT_DEST_NAME="${AWS_SMS_EVENT_DESTINATION_NAME:-}"
# When set to 1, do not fail solely because ACCOUNT_TIER is SANDBOX.
ALLOW_SANDBOX="${AWS_SMS_CHECK_ALLOW_SANDBOX:-0}"
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
      echo "  AWS_SMS_CHECK_ALLOW_SANDBOX=1  — do not treat sandbox tier as FAIL"
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
