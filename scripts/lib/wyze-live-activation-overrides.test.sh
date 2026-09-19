#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
# shellcheck source=scripts/lib/wyze-live-activation-overrides.sh
STAGE=dev
# shellcheck disable=SC2034
WYZE_ALLOW_DISABLE_LIVE=""
source "$ROOT/scripts/lib/wyze-live-activation-overrides.sh"
[[ "${WYZE_ENABLED}" == "true" ]] || { echo "expected WYZE_ENABLED=true on STAGE=dev"; exit 1; }
[[ "${ENABLE_CONNECT_WYZE}" == "true" ]] || { echo "expected ENABLE_CONNECT_WYZE=true"; exit 1; }

STAGE=dev
WYZE_ALLOW_DISABLE_LIVE=1
WYZE_ENABLED=false
ENABLE_CONNECT_WYZE=false
source "$ROOT/scripts/lib/wyze-live-activation-overrides.sh"
[[ "${WYZE_ENABLED}" == "false" ]] || { echo "skip flag should leave WYZE_ENABLED=false"; exit 1; }

STAGE=staging
WYZE_ALLOW_DISABLE_LIVE=""
WYZE_ENABLED=false
ENABLE_CONNECT_WYZE=false
source "$ROOT/scripts/lib/wyze-live-activation-overrides.sh"
[[ "${WYZE_ENABLED}" == "false" ]] || { echo "staging must not force Wyze on"; exit 1; }
echo "wyze-live-activation-overrides.sh ok"
