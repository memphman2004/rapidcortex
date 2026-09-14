#!/usr/bin/env bash
# Attach the Call Assist dialog-hook Lambda to every imported locale on an alias.
# Usage: bash scripts/lex-attach-alias-hooks.sh <alias-id> <alias-name> <bot-version>
# Example: bash scripts/lex-attach-alias-hooks.sh TSTALIASID TestBotAlias DRAFT
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck source=scripts/lib/rapid-cortex-aws.sh
source "${ROOT}/scripts/lib/rapid-cortex-aws.sh"

ALIAS_ID="${1:?alias id}"
ALIAS_NAME="${2:?alias name}"
BOT_VERSION="${3:?bot version}"
STAGE="${DEPLOYMENT_STAGE:-${4:-dev}}"
REGION="${AWS_REGION:-us-east-1}"
BOT_ID="${LEX_BOT_ID:-IJIBJOJG2L}"
TMPDIR_LEX="$(mktemp -d)"
trap 'rm -rf "${TMPDIR_LEX}"' EXIT

if [[ "$STAGE" == "dev" && "${I_UNDERSTAND_DEV_IS_PROD:-}" != "1" ]]; then
  echo "ERROR: source scripts/env-api-dev.sh first." >&2
  exit 1
fi
rapid_cortex_assert_aws_account

DIALOG_ARN="$(aws lambda get-function --function-name "rapid-cortex-lex-dialog-hook-${STAGE}" --query 'Configuration.FunctionArn' --output text --region "${REGION}")"
export ROOT TMPDIR_LEX DIALOG_ARN
python3 - <<'PY'
import json, os, sys
from pathlib import Path
sys.path.insert(0, str(Path(os.environ["ROOT"]) / "scripts"))
from lex_bot_locales import alias_locale_settings, load_merged_spec, spec_locales
root = Path(os.environ["ROOT"])
locales = spec_locales(load_merged_spec(root))
settings = alias_locale_settings(os.environ["DIALOG_ARN"], locales)
Path(os.environ["TMPDIR_LEX"], "alias-settings.json").write_text(json.dumps(settings), encoding="utf-8")
Path(os.environ["TMPDIR_LEX"], "locales.txt").write_text(" ".join(locales), encoding="utf-8")
PY

echo "→ Attaching ${DIALOG_ARN} to ${ALIAS_NAME} (${ALIAS_ID}) locales: $(cat "${TMPDIR_LEX}/locales.txt")"
aws lexv2-models update-bot-alias \
  --bot-id "${BOT_ID}" \
  --bot-alias-id "${ALIAS_ID}" \
  --bot-alias-name "${ALIAS_NAME}" \
  --bot-version "${BOT_VERSION}" \
  --bot-alias-locale-settings "file://${TMPDIR_LEX}/alias-settings.json" \
  --region "${REGION}" >/dev/null

ALIAS_ARN="arn:aws:lex:${REGION}:$(aws sts get-caller-identity --query Account --output text):bot-alias/${BOT_ID}/${ALIAS_ID}"
aws lambda add-permission \
  --function-name "rapid-cortex-lex-dialog-hook-${STAGE}" \
  --statement-id "lex-${ALIAS_ID}" \
  --action lambda:InvokeFunction \
  --principal lexv2.amazonaws.com \
  --source-arn "${ALIAS_ARN}" \
  --region "${REGION}" >/dev/null 2>&1 || true
echo "✅ ${ALIAS_NAME} locale hooks updated"
