#!/usr/bin/env bash
# AWS End User Messaging 10DLC setup via CLI (brand → campaign → number → SNS wiring).
#
# AWS's own docs claim 10DLC registration is console-only; that note is stale. The SMS Voice v2
# API exposes the whole registration flow, so all of it can be scripted.
#
# Usage:
#   ./scripts/setup-aws-10dlc.sh types                 # list registration types this account supports
#   ./scripts/setup-aws-10dlc.sh fields BRAND          # show the fields a brand registration needs
#   ./scripts/setup-aws-10dlc.sh brand                 # create + submit the brand registration
#   ./scripts/setup-aws-10dlc.sh campaign              # create + submit the campaign registration
#   ./scripts/setup-aws-10dlc.sh number                # request the 10DLC number (needs both approved)
#   ./scripts/setup-aws-10dlc.sh wire                  # two-way SMS + delivery events → SNS topics
#   ./scripts/setup-aws-10dlc.sh status                # show every registration and its state
#
# Nothing mutates unless APPLY=1. Registrations submit real filings against your EIN and numbers
# are billable, so the default is a dry run that prints the exact commands.
#
# Values come from the environment so business identifiers stay out of git:
#   scripts/env-aws-10dlc.sh (gitignored) is a good place for them.

set -euo pipefail

REGION="${AWS_REGION:-us-east-1}"
APPLY="${APPLY:-0}"
STATE_FILE="${AWS_10DLC_STATE_FILE:-.aws-10dlc-state.json}"

# Rapid Cortex lives in one account only. Ambient credentials default to a different project's
# account on this machine, and a 10DLC filing landing there is not a no-op: it registers the
# company EIN with TCR under the wrong account and has to be unwound.
EXPECTED_ACCOUNT_ID="${AWS_EXPECTED_ACCOUNT_ID:-158961537080}"

PROFILE_ARGS=()
if [[ -n "${AWS_PROFILE:-}" ]]; then
  PROFILE_ARGS=(--profile "${AWS_PROFILE}")
fi

SMS=(aws pinpoint-sms-voice-v2 --region "${REGION}" ${PROFILE_ARGS[@]+"${PROFILE_ARGS[@]}"})

log()  { printf '%s\n' "$*" >&2; }
fail() { printf 'ERROR: %s\n' "$*" >&2; exit 1; }

require_tool() {
  command -v aws >/dev/null 2>&1 || fail "aws CLI not found"
  command -v jq  >/dev/null 2>&1 || fail "jq not found (brew install jq)"
}

require_correct_account() {
  local actual
  actual="$(aws sts get-caller-identity ${PROFILE_ARGS[@]+"${PROFILE_ARGS[@]}"} \
    --query Account --output text 2>/dev/null || true)"

  [[ -n "${actual}" ]] || fail "no usable AWS credentials (try: export AWS_PROFILE=rapid-cortex)"

  if [[ "${actual}" != "${EXPECTED_ACCOUNT_ID}" ]]; then
    fail "wrong AWS account: credentials resolve to ${actual}, expected ${EXPECTED_ACCOUNT_ID}.
       Run: export AWS_PROFILE=rapid-cortex
       Override only if you truly mean it: AWS_EXPECTED_ACCOUNT_ID=${actual}"
  fi
}

usage() {
  cat >&2 <<'EOF'
AWS End User Messaging 10DLC setup (brand -> campaign -> number -> SNS wiring).

  ./scripts/setup-aws-10dlc.sh types         list registration types this account supports
  ./scripts/setup-aws-10dlc.sh fields BRAND  show the fields a registration needs
  ./scripts/setup-aws-10dlc.sh brand         create + submit the brand registration
  ./scripts/setup-aws-10dlc.sh campaign      create + submit the campaign registration
  ./scripts/setup-aws-10dlc.sh number        request the 10DLC number (needs both approved)
  ./scripts/setup-aws-10dlc.sh wire          two-way SMS + delivery events -> SNS topics
  ./scripts/setup-aws-10dlc.sh status        registrations, account tier, verified numbers
  ./scripts/setup-aws-10dlc.sh verify +1555… verify a test number (needed while in SANDBOX)
  ./scripts/setup-aws-10dlc.sh confirm +1555… 123456   confirm the code it texted you

Nothing mutates unless APPLY=1. Registrations submit real filings against your EIN and
numbers are billable, so the default is a dry run that prints the exact commands.

Field values come from JSON files of {"fieldPath": value}, so business identifiers stay
out of git and message samples can contain any punctuation:
  AWS_10DLC_BRAND_FIELDS_FILE=scripts/aws-10dlc/brand.json
  AWS_10DLC_CAMPAIGN_FIELDS_FILE=scripts/aws-10dlc/campaign.json
See the .example.json files next to those paths.
EOF
}

# Prints the command, and only runs it when APPLY=1.
run() {
  if [[ "${APPLY}" != "1" ]]; then
    log "DRY RUN: ${*}"
    return 0
  fi
  "$@"
}

state_get() {
  [[ -f "${STATE_FILE}" ]] || { echo ""; return 0; }
  jq -r --arg k "$1" '.[$k] // ""' "${STATE_FILE}"
}

state_set() {
  local key="$1" value="$2" tmp
  [[ -f "${STATE_FILE}" ]] || echo '{}' > "${STATE_FILE}"
  tmp="$(mktemp)"
  jq --arg k "${key}" --arg v "${value}" '.[$k] = $v' "${STATE_FILE}" > "${tmp}"
  mv "${tmp}" "${STATE_FILE}"
  log "  saved ${key}=${value} → ${STATE_FILE}"
}

# Named exactly rather than pattern-matched: "BRAND" also substring-matches
# US_TEN_DLC_BRAND_VETTING, a separate paid enhanced-vetting filing that is not the brand
# registration. Each name is still verified against the account, so API drift fails loudly here
# rather than three weeks into the process.
resolve_registration_type() {
  local want="$1" wanted types
  case "${want}" in
    BRAND)    wanted="${AWS_10DLC_BRAND_TYPE:-US_TEN_DLC_BRAND_REGISTRATION}" ;;
    CAMPAIGN) wanted="${AWS_10DLC_CAMPAIGN_TYPE:-US_TEN_DLC_CAMPAIGN_REGISTRATION}" ;;
    VETTING)  wanted="${AWS_10DLC_VETTING_TYPE:-US_TEN_DLC_BRAND_VETTING}" ;;
    *)        wanted="${want}" ;;
  esac

  types="$("${SMS[@]}" describe-registration-type-definitions \
    --query 'RegistrationTypeDefinitions[].RegistrationType' --output text 2>/dev/null || true)"
  [[ -n "${types}" ]] || fail "could not list registration types (check credentials and region ${REGION})"

  if ! printf '%s\n' ${types} | grep -Fxq "${wanted}"; then
    log "10DLC registration types available in this account:"
    printf '%s\n' ${types} | grep -F TEN_DLC | sed 's/^/  /' >&2
    fail "'${wanted}' is not offered in ${REGION}"
  fi

  printf '%s' "${wanted}"
}

cmd_types() {
  "${SMS[@]}" describe-registration-type-definitions \
    --query 'RegistrationTypeDefinitions[].{Type:RegistrationType,Display:DisplayHints.Title}' \
    --output table
}

cmd_fields() {
  local want="${1:-BRAND}" type
  type="$(resolve_registration_type "${want}")"
  log "Fields for ${type} (use these paths as the keys of your JSON field file):"
  {
    printf 'FIELD\tREQUIREMENT\tTYPE\tALLOWED_VALUES\n'
    "${SMS[@]}" describe-registration-field-definitions --registration-type "${type}" --output json \
      | jq -r '.RegistrationFieldDefinitions[]
                 | [ .FieldPath,
                     .FieldRequirement,
                     .FieldType,
                     ((.SelectValidation.Options // []) | join("|")) ]
                 | @tsv'
  } | column -t -s "$(printf '\t')"
}

# Applies a JSON object of {"fieldPath": value} to a registration. A file rather than delimited
# env vars because campaign message samples contain commas, semicolons, and newlines.
#
# TEXT and SELECT fields take different CLI flags, and most campaign fields are SELECT, so the
# type is looked up from the API instead of assumed. JSON arrays become multi-choice selects.
put_fields() {
  local registration_id="$1" type="$2" file="$3"
  local defs path value field_type
  local -a choices=()

  if [[ -z "${file}" ]]; then
    log "  (no field file set; run '$0 fields' then point the *_FIELDS_FILE env var at your JSON)"
    return 0
  fi
  [[ -f "${file}" ]] || fail "field file not found: ${file}"
  jq -e 'type == "object"' "${file}" >/dev/null 2>&1 || fail "${file} must be a JSON object of fieldPath -> value"

  defs="$("${SMS[@]}" describe-registration-field-definitions --registration-type "${type}" \
    --query 'RegistrationFieldDefinitions[].[FieldPath,FieldType]' --output text)"

  while IFS=$'\t' read -r path value; do
    [[ -n "${path}" ]] || continue
    # Values arrive base64-encoded because jq's @tsv rewrites the newlines in multi-line message
    # samples as a literal backslash-n, which would be filed with the carriers verbatim.
    value="$(printf '%s' "${value}" | base64 -d)"
    field_type="$(printf '%s\n' "${defs}" | awk -F'\t' -v p="${path}" '$1==p {print $2; exit}')"

    case "${field_type}" in
      TEXT)
        run "${SMS[@]}" put-registration-field-value \
          --registration-id "${registration_id}" --field-path "${path}" --text-value "${value}"
        ;;
      SELECT)
        IFS=',' read -r -a choices <<< "${value}"
        run "${SMS[@]}" put-registration-field-value \
          --registration-id "${registration_id}" --field-path "${path}" --select-choices "${choices[@]}"
        ;;
      ATTACHMENT)
        fail "'${path}' is an ATTACHMENT — upload it with create-registration-attachment and pass the attachment id"
        ;;
      "")
        fail "'${path}' is not a valid field for ${type} — run '$0 fields' for the list"
        ;;
      *)
        fail "unsupported field type '${field_type}' for '${path}'"
        ;;
    esac
  done < <(jq -r 'to_entries[]
                  | [.key, (.value | if type == "array" then join(",") else tostring end | @base64)]
                  | @tsv' "${file}")
}

# A submitted version is frozen: field edits raise EDIT_REGISTRATION_FIELD_VALUES_NOT_ALLOWED.
# Recovering from a denial means opening a fresh version, which starts empty — hence every run
# re-puts the whole field file rather than only the field that was rejected.
ensure_draft_version() {
  local registration_id="$1" status

  status="$("${SMS[@]}" describe-registration-versions --registration-id "${registration_id}" \
    --query 'reverse(sort_by(RegistrationVersions,&VersionNumber))[0].RegistrationVersionStatus' \
    --output text 2>/dev/null || true)"

  case "${status}" in
    ""|None|DRAFT) return 0 ;;
    APPROVED)
      fail "registration ${registration_id} is already APPROVED — nothing to resubmit"
      ;;
    REVIEWING|SUBMITTED)
      fail "version is ${status}; wait for the review to finish before editing"
      ;;
    *)
      log "  latest version is ${status}; opening a new draft"
      run "${SMS[@]}" create-registration-version --registration-id "${registration_id}"
      ;;
  esac
}

create_and_submit() {
  local kind="$1" type_hint="$2" fields_file="$3" state_key="$4" associate_brand_id="${5:-}"
  local type registration_id

  type="$(resolve_registration_type "${type_hint}")"
  log "▶ ${kind} registration (${type})"

  # Reused from state so a partial run can be re-driven without opening a second filing.
  registration_id="$(state_get "${state_key}")"
  if [[ -n "${registration_id}" ]]; then
    log "  reusing ${registration_id} from ${STATE_FILE}"
    ensure_draft_version "${registration_id}"
  elif [[ "${APPLY}" == "1" ]]; then
    registration_id="$("${SMS[@]}" create-registration --registration-type "${type}" \
      --query 'RegistrationId' --output text)"
    state_set "${state_key}" "${registration_id}"
  else
    log "DRY RUN: ${SMS[*]} create-registration --registration-type ${type}"
    registration_id="<new-registration-id>"
  fi

  [[ -n "${associate_brand_id}" ]] && associate_campaign_brand "${registration_id}" "${associate_brand_id}"

  put_fields "${registration_id}" "${type}" "${fields_file}"
  run "${SMS[@]}" submit-registration-version --registration-id "${registration_id}"
  log "  submitted; poll with: $0 status"
}

cmd_brand() {
  create_and_submit "Brand" "BRAND" "${AWS_10DLC_BRAND_FIELDS_FILE:-}" brandRegistrationId
}

# The campaign's association behavior against the brand is ASSOCIATE_BEFORE_SUBMIT, so an
# unassociated campaign fails submit with SUBMIT_REGISTRATION_VERSION_NOT_ALLOWED even when every
# required field is populated. Associating is idempotent enough to retry, so failures are ignored.
associate_campaign_brand() {
  local campaign_id="$1" brand_id="$2"
  [[ -n "${brand_id}" ]] || return 0

  if [[ "${APPLY}" != "1" ]]; then
    log "DRY RUN: ${SMS[*]} create-registration-association --registration-id ${campaign_id} --resource-id ${brand_id}"
    return 0
  fi

  log "  associating campaign with brand ${brand_id}"
  "${SMS[@]}" create-registration-association \
    --registration-id "${campaign_id}" --resource-id "${brand_id}" >/dev/null 2>&1 \
    || log "  (already associated)"
}

cmd_campaign() {
  local brand_id
  brand_id="$(state_get brandRegistrationId)"
  [[ -n "${brand_id}" || "${APPLY}" != "1" ]] || fail "run '$0 brand' first — a campaign needs an approved brand"
  create_and_submit "Campaign" "CAMPAIGN" "${AWS_10DLC_CAMPAIGN_FIELDS_FILE:-}" campaignRegistrationId "${brand_id}"
}

cmd_number() {
  local campaign_id
  local -a extra_args=()

  campaign_id="$(state_get campaignRegistrationId)"
  [[ -n "${campaign_id}" || "${APPLY}" != "1" ]] || fail "run '$0 campaign' first — a 10DLC number needs an approved campaign"

  # Built as an array so an unset pool omits the flag entirely rather than passing an empty
  # argument, which the CLI rejects.
  if [[ -n "${AWS_SMS_POOL_ID:-}" ]]; then
    extra_args+=(--pool-id "${AWS_SMS_POOL_ID}")
  fi

  # No area code or number selection exists in this API: AWS assigns whatever it has for the
  # country and number type. Unlike Twilio, you cannot search for or reserve a specific number.
  log "▶ Requesting 10DLC number (AWS assigns it — area code cannot be specified)"
  run "${SMS[@]}" request-phone-number \
    --iso-country-code US \
    --message-type TRANSACTIONAL \
    --number-capabilities SMS \
    --number-type TEN_DLC \
    --registration-id "${campaign_id:-<campaign-registration-id>}" \
    --deletion-protection-enabled \
    ${extra_args[@]+"${extra_args[@]}"}
  log "  save the returned PhoneNumberId, then run: $0 wire"
}

# Connects the number and configuration set to the SNS topics created by stack-app-sam-5.
cmd_wire() {
  local phone_number_id="${AWS_SMS_PHONE_NUMBER_ID:-}"
  local inbound_arn="${AWS_SMS_INBOUND_TOPIC_ARN:-}"
  local events_arn="${AWS_SMS_DELIVERY_EVENTS_TOPIC_ARN:-}"
  local config_set="${AWS_SMS_CONFIGURATION_SET_NAME:-}"

  [[ -n "${phone_number_id}" ]] || fail "set AWS_SMS_PHONE_NUMBER_ID"
  [[ -n "${inbound_arn}" ]] || fail "set AWS_SMS_INBOUND_TOPIC_ARN (stack 5 output AwsSmsInboundTopicArn)"

  log "▶ Enabling two-way SMS → ${inbound_arn}"
  run "${SMS[@]}" update-phone-number \
    --phone-number-id "${phone_number_id}" \
    --two-way-enabled \
    --two-way-channel-arn "${inbound_arn}"

  if [[ -n "${config_set}" && -n "${events_arn}" ]]; then
    log "▶ Routing delivery events → ${events_arn}"
    run "${SMS[@]}" create-event-destination \
      --configuration-set-name "${config_set}" \
      --event-destination-name rapid-cortex-delivery-events \
      --matching-event-types TEXT_ALL \
      --sns-destination "TopicArn=${events_arn}"
  else
    log "  skipping delivery events (set AWS_SMS_CONFIGURATION_SET_NAME and AWS_SMS_DELIVERY_EVENTS_TOPIC_ARN)"
  fi
}

cmd_status() {
  local tier

  log "Registrations:"
  "${SMS[@]}" describe-registrations \
    --query 'Registrations[].{Id:RegistrationId,Type:RegistrationType,Status:RegistrationStatus,Version:CurrentVersionNumber}' \
    --output table

  tier="$("${SMS[@]}" describe-account-attributes \
    --query 'AccountAttributes[?Name==`ACCOUNT_TIER`].Value' --output text)"
  log "Account tier: ${tier:-unknown}"

  if [[ "${tier}" == "SANDBOX" ]]; then
    log ""
    log "  SANDBOX only delivers to verified destination numbers. Production access is a separate"
    log "  AWS support request and is not part of 10DLC registration — start both, they run in parallel."
    log "  To test now: $0 verify +15555550100"
    log ""
    log "Verified destination numbers:"
    "${SMS[@]}" describe-verified-destination-numbers \
      --query 'VerifiedDestinationNumbers[].{Number:DestinationPhoneNumber,Status:Status}' \
      --output table
  fi
}

verified_id_for() {
  local found
  found="$("${SMS[@]}" describe-verified-destination-numbers \
    --destination-phone-numbers "$1" \
    --query 'VerifiedDestinationNumbers[0].VerifiedDestinationNumberId' \
    --output text 2>/dev/null || true)"
  [[ "${found}" == "None" ]] && found=""
  printf '%s' "${found}"
}

# Sandbox testing path: AWS refuses to deliver to an unverified number while the account is in
# SANDBOX, so the whole send/receive pipeline can be exercised before 10DLC clears.
cmd_verify() {
  local phone="${1:-${AWS_SMS_TEST_NUMBER:-}}" id
  [[ -n "${phone}" ]] || fail "usage: $0 verify +15555550100"

  id="$(verified_id_for "${phone}")"
  if [[ -n "${id}" ]]; then
    log "▶ ${phone} already registered as ${id}"
  elif [[ "${APPLY}" == "1" ]]; then
    id="$("${SMS[@]}" create-verified-destination-number \
      --destination-phone-number "${phone}" \
      --query 'VerifiedDestinationNumberId' --output text)"
    log "▶ created ${id} for ${phone}"
  else
    log "DRY RUN: ${SMS[*]} create-verified-destination-number --destination-phone-number ${phone}"
    id="<verified-destination-number-id>"
  fi

  run "${SMS[@]}" send-destination-number-verification-code \
    --verified-destination-number-id "${id}" --verification-channel TEXT
  log "  then: $0 confirm ${phone} <code-from-the-text>"
}

cmd_confirm() {
  local phone="${1:-}" code="${2:-}" id
  [[ -n "${phone}" && -n "${code}" ]] || fail "usage: $0 confirm +15555550100 123456"

  id="$(verified_id_for "${phone}")"
  [[ -n "${id}" || "${APPLY}" != "1" ]] || fail "${phone} was never registered — run '$0 verify ${phone}' first"

  run "${SMS[@]}" verify-destination-number \
    --verified-destination-number-id "${id:-<verified-destination-number-id>}" \
    --verification-code "${code}"
}

main() {
  require_tool
  require_correct_account
  local sub="${1:-}"
  shift || true

  case "${sub}" in
    brand|campaign|number|wire|verify|confirm)
      [[ "${APPLY}" == "1" ]] || log "── DRY RUN (set APPLY=1 to execute) ──"
      ;;
  esac

  case "${sub}" in
    types)    cmd_types ;;
    fields)   cmd_fields "${1:-BRAND}" ;;
    brand)    cmd_brand ;;
    campaign) cmd_campaign ;;
    number)   cmd_number ;;
    wire)     cmd_wire ;;
    status)   cmd_status ;;
    verify)   cmd_verify "${1:-}" ;;
    confirm)  cmd_confirm "${1:-}" "${2:-}" ;;
    *)        usage; exit 1 ;;
  esac
}

main "$@"
