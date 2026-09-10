#!/usr/bin/env bash
# Sync connect/lex-bot-complete-spec.md onto Lex DRAFT locales only.
# Does not update alias live-${STAGE}. Test with TSTALIASID, then:
#   bash scripts/publish-lex-alias.sh ${STAGE}
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck source=scripts/lib/rapid-cortex-aws.sh
source "${ROOT}/scripts/lib/rapid-cortex-aws.sh"

STAGE="${1:-dev}"
BOT_ID="${LEX_BOT_ID:-IJIBJOJG2L}"

if [[ "$STAGE" == "dev" && "${I_UNDERSTAND_DEV_IS_PROD:-}" != "1" ]]; then
  echo "ERROR: source scripts/env-api-dev.sh first." >&2
  exit 1
fi
rapid_cortex_assert_aws_account

# bot-spec.json is the source of truth (includes Welcome). Do not regenerate from
# connect/lex-bot-complete-spec.md — that markdown has no Welcome intent.
python3 "${ROOT}/scripts/sync-lex-bot-draft.py"

echo "✅ DRAFT locales Built. Test with bot alias TSTALIASID — live-${STAGE} is unchanged."
echo "   Associate rapid-cortex-lex-dialog-hook-${STAGE} on TestBotAlias for en_US and es_US,"
echo "   then run RecognizeText or use the Lex console test window."
echo "   When both locales pass: bash scripts/publish-lex-alias.sh ${STAGE}"
echo "   Bot ID ${BOT_ID}"
