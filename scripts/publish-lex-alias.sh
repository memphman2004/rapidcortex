#!/usr/bin/env bash
# Snapshot DRAFT into a numbered version and point live-${STAGE} at it.
# Run only after RecognizeText on TSTALIASID passes for the imported locales.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck source=scripts/lib/rapid-cortex-aws.sh
source "${ROOT}/scripts/lib/rapid-cortex-aws.sh"

STAGE="${1:-dev}"
REGION="${AWS_REGION:-us-east-1}"
BOT_ID="${LEX_BOT_ID:-IJIBJOJG2L}"
ALIAS_ID="${LEX_BOT_ALIAS_ID:-0CNPVSCF4V}"
TMPDIR_LEX="$(mktemp -d)"
trap 'rm -rf "${TMPDIR_LEX}"' EXIT

if [[ "$STAGE" == "dev" && "${I_UNDERSTAND_DEV_IS_PROD:-}" != "1" ]]; then
  echo "ERROR: source scripts/env-api-dev.sh first." >&2
  exit 1
fi
rapid_cortex_assert_aws_account

DIALOG_ARN="$(aws lambda get-function --function-name "rapid-cortex-lex-dialog-hook-${STAGE}" --query 'Configuration.FunctionArn' --output text --region "${REGION}")"

export ROOT TMPDIR_LEX DIALOG_ARN
ROOT="${ROOT}" DIALOG_ARN="${DIALOG_ARN}" TMPDIR_LEX="${TMPDIR_LEX}" python3 - <<'PY'
import json, os, sys
from pathlib import Path
sys.path.insert(0, str(Path(os.environ["ROOT"]) / "scripts"))
from lex_bot_locales import alias_locale_settings, bot_version_locale_specification, load_merged_spec, spec_locales
root = Path(os.environ["ROOT"])
out = Path(os.environ["TMPDIR_LEX"])
locales = spec_locales(load_merged_spec(root))
arn = os.environ["DIALOG_ARN"]
(out / "version-spec.json").write_text(json.dumps(bot_version_locale_specification(locales)), encoding="utf-8")
(out / "alias-settings.json").write_text(json.dumps(alias_locale_settings(arn, locales)), encoding="utf-8")
(out / "locales.txt").write_text(" ".join(locales), encoding="utf-8")
PY

LOCALES="$(cat "${TMPDIR_LEX}/locales.txt")"
echo "→ Creating bot version from DRAFT locales: ${LOCALES}"
VERSION="$(aws lexv2-models create-bot-version \
  --bot-id "${BOT_ID}" \
  --bot-version-locale-specification "file://${TMPDIR_LEX}/version-spec.json" \
  --description "Call Assist 20-intent spec + 911 language pack" \
  --region "${REGION}" \
  --query 'botVersion' --output text)"

echo "   botVersion=${VERSION}"
echo "→ Waiting for version…"
for _ in $(seq 1 60); do
  ST="$(aws lexv2-models describe-bot-version --bot-id "${BOT_ID}" --bot-version "${VERSION}" --region "${REGION}" --query 'botStatus' --output text 2>/dev/null || echo Creating)"
  echo "   status=${ST}"
  if [[ "${ST}" == "Available" ]]; then
    break
  fi
  if [[ "${ST}" == "Failed" ]]; then
    echo "ERROR: bot version ${VERSION} failed" >&2
    exit 1
  fi
  sleep 5
done

echo "→ Updating alias live-${STAGE} (${ALIAS_ID}) → version ${VERSION}…"
aws lexv2-models update-bot-alias \
  --bot-id "${BOT_ID}" \
  --bot-alias-id "${ALIAS_ID}" \
  --bot-alias-name "live-${STAGE}" \
  --bot-version "${VERSION}" \
  --bot-alias-locale-settings "file://${TMPDIR_LEX}/alias-settings.json" \
  --region "${REGION}" >/dev/null

echo "✅ live-${STAGE} now points at version ${VERSION} (${LOCALES})"
