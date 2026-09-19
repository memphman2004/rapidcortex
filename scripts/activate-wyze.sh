#!/usr/bin/env bash
# Rotate Rapid Cortex Wyze developer API credentials, then enable the live stack.
#
# Track 3 activation (this month). Two steps:
#   1. Put a real keyId + apiKey into Secrets Manager (this script).
#   2. Flip WyzeEnabled=true on rapid-cortex-dev via deploy.sh (sourced overlay).
#
# Usage:
#   export AWS_PROFILE=rapid-cortex   # or equivalent
#   export WYZE_KEY_ID='...'          # Wyze developer console Key ID
#   export WYZE_API_KEY='...'         # Wyze developer console API key
#   bash scripts/activate-wyze.sh rotate
#   bash scripts/activate-wyze.sh status
#   source scripts/env-api-dev.sh && bash scripts/deploy.sh dev
#
# Never commit WYZE_KEY_ID / WYZE_API_KEY. Homeowner streams use per-owner keys
# collected at /connect/wyze — this secret is RC-owned test devices only.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REGION="${AWS_REGION:-us-east-1}"
STACK_NAME="${STACK_NAME:-rapid-cortex-dev}"
SECRET_ID="${WYZE_API_KEYS_SECRET_ID:-rapid-cortex/connect/wyze-api-keys}"
SECRET_ARN="${WYZE_API_KEYS_SECRET_ARN:-arn:aws:secretsmanager:us-east-1:158961537080:secret:rapid-cortex/connect/wyze-api-keys-YIoY3S}"

usage() {
  sed -n '2,18p' "$0"
  echo ""
  echo "Commands: rotate | status | verify"
}

looks_like_placeholder() {
  local v="${1:-}"
  local lower
  lower="$(printf '%s' "$v" | tr '[:upper:]' '[:lower:]')"
  [[ -z "$v" ]] && return 0
  [[ ${#v} -lt 8 ]] && return 0
  case "$lower" in
    *placeholder* | *changeme* | *your_* | *todo* | *example* | *xxxx*) return 0 ;;
  esac
  return 1
}

require_aws() {
  if ! command -v aws >/dev/null 2>&1; then
    echo "ERROR: aws CLI is required." >&2
    exit 1
  fi
  if ! aws sts get-caller-identity --region "$REGION" >/dev/null 2>&1; then
    echo "ERROR: AWS credentials are not usable in this environment." >&2
    echo "  export AWS_PROFILE=rapid-cortex (or equivalent) and retry." >&2
    echo "  Do not paste Wyze keys into git, chat, or CloudWatch." >&2
    exit 2
  fi
}

cmd_status() {
  require_aws
  echo "Stack: ${STACK_NAME}  Region: ${REGION}"
  aws cloudformation describe-stacks \
    --region "$REGION" \
    --stack-name "$STACK_NAME" \
    --query "Stacks[0].Parameters[?ParameterKey=='WyzeEnabled'].ParameterValue | [0]" \
    --output text
  echo "Secret: ${SECRET_ID}"
  aws secretsmanager describe-secret \
    --region "$REGION" \
    --secret-id "${SECRET_ARN}" \
    --query '{Name:Name,LastChangedDate:LastChangedDate,ARN:ARN}' \
    --output table
  echo "Next: if WyzeEnabled is false, rotate (if needed) then:"
  echo "  source scripts/env-api-dev.sh && bash scripts/deploy.sh dev"
}

cmd_rotate() {
  require_aws
  if looks_like_placeholder "${WYZE_KEY_ID:-}" || looks_like_placeholder "${WYZE_API_KEY:-}"; then
    echo "ERROR: Set WYZE_KEY_ID and WYZE_API_KEY to real Wyze developer credentials." >&2
    echo "  Create them at https://developer-api-console.wyze.com/#/apikey/view" >&2
    echo "  Placeholders / empty values are refused." >&2
    exit 1
  fi
  local payload
  payload="$(python3 - <<'PY'
import json, os
print(json.dumps({"keyId": os.environ["WYZE_KEY_ID"].strip(), "apiKey": os.environ["WYZE_API_KEY"].strip()}))
PY
)"
  aws secretsmanager put-secret-value \
    --region "$REGION" \
    --secret-id "${SECRET_ARN}" \
    --secret-string "$payload" \
    --query '{ARN:ARN,VersionId:VersionId,VersionStages:VersionStages}' \
    --output table
  echo "Rotated ${SECRET_ID}. Value not printed."
  echo "Verify against Wyze (optional): bash scripts/activate-wyze.sh verify"
  echo "Then enable the stack: source scripts/env-api-dev.sh && bash scripts/deploy.sh dev"
}

cmd_verify() {
  require_aws
  if looks_like_placeholder "${WYZE_KEY_ID:-}" || looks_like_placeholder "${WYZE_API_KEY:-}"; then
    echo "ERROR: verify needs WYZE_KEY_ID and WYZE_API_KEY in the environment (not read back from Secrets Manager in this script)." >&2
    exit 1
  fi
  local ts
  ts="$(python3 -c 'import time; print(int(time.time()*1000))')"
  local code
  code="$(
    curl -sS -o /tmp/wyze-verify.json -w '%{http_code}' \
      -X POST 'https://api.wyzecam.com/v2/home_page/get_object_list' \
      -H "Content-Type: application/json" \
      -H "Apikey: ${WYZE_API_KEY}" \
      -H "Keyid: ${WYZE_KEY_ID}" \
      -d "{\"sv\":\"9b2bdd9344f64555dc4ab0ccfc70eb5e\",\"sc\":\"9f275790cab94a72bd206c8876429f3c\",\"ts\":${ts}}"
  )"
  echo "Wyze HTTP ${code}"
  python3 - <<'PY'
import json
from pathlib import Path
raw = Path("/tmp/wyze-verify.json").read_text(encoding="utf-8")
try:
    data = json.loads(raw)
except json.JSONDecodeError:
    print(raw[:300])
    raise SystemExit(1)
code = str(data.get("code", ""))
devices = (data.get("data") or {}).get("device_list") or []
print(f"Wyze code={code} devices={len(devices)}")
if code not in {"1", "200"} and not devices:
    raise SystemExit(1)
PY
}

cmd="${1:-}"
case "$cmd" in
  rotate) cmd_rotate ;;
  status) cmd_status ;;
  verify) cmd_verify ;;
  -h | --help | help | "") usage ;;
  *)
    echo "Unknown command: $cmd" >&2
    usage
    exit 1
    ;;
esac
