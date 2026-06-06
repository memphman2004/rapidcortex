#!/usr/bin/env bash
# Bootstrap / optional create: AWS End User Messaging SMS (pinpoint-sms-voice-v2) resources.
# App runtime sends SMS via Amazon SNS Publish; pool + configuration set are operational / delivery config.
set -euo pipefail

usage() {
  cat <<'EOF'
Usage:
  export AWS_REGION=us-east-1
  export AWS_SMS_POOL_NAME=rapid-cortex-sms-pool
  export AWS_SMS_CONFIGURATION_SET_NAME=rapid-cortex-sms
  # Optional:
  # export AWS_SMS_ORIGINATION_IDENTITY_ARN=arn:aws:sms-voice:...:phone-number/xxx
  # export AWS_SMS_POOL_ISO_COUNTRY_CODE=US
  # export AWS_SMS_EVENT_DESTINATION_NAME=rapid-cortex-events
  # export AWS_SMS_EVENT_SNS_TOPIC_ARN=arn:aws:sns:...
  # export AWS_PROFILE=...
  ./scripts/setup-aws-sms-backup.sh

Or pass: --region R --pool-name N --configuration-set C [--origination-arn A] [--iso-code US]
          [--event-destination-name E] [--event-sns-topic-arn T] [--profile P]
EOF
}

REGION="${AWS_REGION:-}"
POOL_NAME="${AWS_SMS_POOL_NAME:-}"
CONFIG_SET="${AWS_SMS_CONFIGURATION_SET_NAME:-}"
ORIG_ARN="${AWS_SMS_ORIGINATION_IDENTITY_ARN:-}"
ISO_CODE="${AWS_SMS_POOL_ISO_COUNTRY_CODE:-US}"
EVENT_DEST_NAME="${AWS_SMS_EVENT_DESTINATION_NAME:-}"
EVENT_TOPIC_ARN="${AWS_SMS_EVENT_SNS_TOPIC_ARN:-}"
PROFILE_ARG=()
POOL_ID_OUT=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --region) REGION="${2:-}"; shift 2 ;;
    --pool-name) POOL_NAME="${2:-}"; shift 2 ;;
    --configuration-set) CONFIG_SET="${2:-}"; shift 2 ;;
    --origination-arn) ORIG_ARN="${2:-}"; shift 2 ;;
    --iso-code) ISO_CODE="${2:-}"; shift 2 ;;
    --event-destination-name) EVENT_DEST_NAME="${2:-}"; shift 2 ;;
    --event-sns-topic-arn) EVENT_TOPIC_ARN="${2:-}"; shift 2 ;;
    --profile) PROFILE_ARG=(--profile "${2:-}"); shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown arg: $1" >&2; usage; exit 1 ;;
  esac
done

if [[ -n "${AWS_PROFILE:-}" && ${#PROFILE_ARG[@]} -eq 0 ]]; then
  PROFILE_ARG=(--profile "${AWS_PROFILE}")
fi

if [[ -z "$REGION" ]]; then
  echo "ERROR: AWS_REGION (or --region) is required." >&2
  exit 1
fi

require_cli() {
  if ! command -v aws &>/dev/null; then
    echo "ERROR: AWS CLI not found. Install AWS CLI v2." >&2
    exit 1
  fi
  if ! aws "${PROFILE_ARG[@]}" sts get-caller-identity --region "${REGION}" &>/dev/null; then
    echo "ERROR: AWS CLI not authenticated (sts get-caller-identity failed). Configure credentials." >&2
    exit 1
  fi
}

require_cli

PINPOINT=(aws pinpoint-sms-voice-v2 "${PROFILE_ARG[@]}" --region "${REGION}")

account_tier() {
  "${PINPOINT[@]}" describe-account-attributes --no-paginate --output json \
    | python3 - <<'PY'
import json, sys
j = json.load(sys.stdin)
attrs = j.get("AccountAttributes") or []
for a in attrs:
    if a.get("Name") == "ACCOUNT_TIER":
        print(a.get("Value", "").upper())
        sys.exit(0)
print("UNKNOWN")
PY
}

find_pool_id_by_tag_name() {
  local name="$1"
  "${PINPOINT[@]}" describe-pools --no-paginate --output json 2>/dev/null \
    | python3 -c "import json,sys
name = sys.argv[1]
j = json.load(sys.stdin)
for p in j.get('Pools') or []:
  for t in p.get('Tags') or []:
    if t.get('Key') == 'Name' and t.get('Value') == name:
      print(p.get('PoolId', ''))
      sys.exit(0)
sys.exit(1)
" "$name"
}

config_set_exists() {
  local cname="$1"
  "${PINPOINT[@]}" describe-configuration-sets \
    --configuration-set-names "$cname" \
    --no-paginate --output json | python3 -c "import json,sys; j=json.load(sys.stdin); sys.exit(0 if (j.get('ConfigurationSets') or []) else 1)"
}

event_dest_exists() {
  local cname="$1" edname="$2"
  "${PINPOINT[@]}" describe-configuration-sets --configuration-set-names "$cname" --no-paginate --output json \
    | python3 -c "import json,sys
w = sys.argv[1]
j = json.load(sys.stdin)
for cs in j.get('ConfigurationSets') or []:
  for ed in cs.get('EventDestinations') or []:
    if (ed.get('Name') or ed.get('EventDestinationName')) == w:
      sys.exit(0)
sys.exit(1)
" "$edname"
}

TIER="$(account_tier)"
echo "=== AWS End User Messaging SMS (region=$REGION) ==="
echo "Account tier (ACCOUNT_TIER): $TIER"

if [[ "$TIER" == "SANDBOX" ]]; then
  echo "NOTE: Account is in SMS sandbox. Verified test numbers work; open production via Support for unrestricted A2P sending in this region."
fi

CREATED_POOL=""
if [[ -n "$ORIG_ARN" ]]; then
  if [[ -z "$POOL_NAME" ]]; then
    echo "ERROR: AWS_SMS_POOL_NAME (or --pool-name) is required when AWS_SMS_ORIGINATION_IDENTITY_ARN is set." >&2
    exit 1
  fi
  EXISTING=""
  if EXISTING="$(find_pool_id_by_tag_name "$POOL_NAME" 2>/dev/null)" && [[ -n "$EXISTING" ]]; then
    echo "Pool with tag Name=$POOL_NAME already exists: $EXISTING (reusing)."
    POOL_ID_OUT="$EXISTING"
  else
    echo "Creating pool (origination identity + ISO $ISO_CODE, TRANSACTIONAL) with tag Name=$POOL_NAME..."
    OUT=$("${PINPOINT[@]}" create-pool \
      --origination-identity "$ORIG_ARN" \
      --iso-country-code "$ISO_CODE" \
      --message-type TRANSACTIONAL \
      --tags "Key=Name,Value=${POOL_NAME}" \
      --output json)
    CREATED_POOL="$(python3 -c "import json,sys; print(json.load(sys.stdin).get('PoolId',''))" <<<"$OUT")"
    POOL_ID_OUT="$CREATED_POOL"
    echo "Created pool id: $POOL_ID_OUT"
  fi
else
  echo "Skipping create-pool (set AWS_SMS_ORIGINATION_IDENTITY_ARN to create a phone pool)."
fi

if [[ -n "$CONFIG_SET" ]]; then
  if config_set_exists "$CONFIG_SET"; then
    echo "Configuration set '$CONFIG_SET' already exists (reusing)."
  else
    echo "Creating configuration set '$CONFIG_SET'..."
    "${PINPOINT[@]}" create-configuration-set --configuration-set-name "$CONFIG_SET" --output json
  fi
else
  echo "Skipping configuration set (set AWS_SMS_CONFIGURATION_SET_NAME to create one)."
fi

if [[ -n "$CONFIG_SET" && -n "$EVENT_DEST_NAME" && -n "$EVENT_TOPIC_ARN" ]]; then
  if event_dest_exists "$CONFIG_SET" "$EVENT_DEST_NAME"; then
    echo "Event destination '$EVENT_DEST_NAME' already on configuration set '$CONFIG_SET' (reusing)."
  else
    echo "Creating event destination '$EVENT_DEST_NAME' -> SNS $EVENT_TOPIC_ARN ..."
    "${PINPOINT[@]}" create-event-destination \
      --configuration-set-name "$CONFIG_SET" \
      --event-destination-name "$EVENT_DEST_NAME" \
      --matching-event-types ALL \
      --sns-destination "TopicArn=${EVENT_TOPIC_ARN}" \
      --output json
  fi
elif [[ -n "$EVENT_DEST_NAME" || -n "$EVENT_TOPIC_ARN" ]]; then
  echo "WARN: Set both AWS_SMS_EVENT_DESTINATION_NAME and AWS_SMS_EVENT_SNS_TOPIC_ARN to create an event destination."
fi

echo ""
echo "=== Summary ==="
echo "Region:              $REGION"
echo "Account tier:        $TIER"
if [[ -n "$POOL_ID_OUT" ]]; then
  echo "Pool id:             $POOL_ID_OUT"
fi
if [[ -n "$CONFIG_SET" ]]; then
  echo "Configuration set:   $CONFIG_SET"
fi
if [[ "$TIER" == "SANDBOX" ]]; then
  echo "Next steps: For production SMS outside sandbox in this region, open an AWS Support case (service limit / production access) for End User Messaging SMS."
fi
echo "Application runtime: use Amazon SNS Publish (see docs/aws-sms-backup-setup.md). Set AWS_SMS_POOL_ID / AWS_SMS_CONFIGURATION_SET_NAME in env for ops visibility; SNS SMS routing uses account / origination settings."
