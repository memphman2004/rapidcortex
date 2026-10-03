#!/usr/bin/env bash
# Call Assist Phase 2 — vendor refresh + unit tests + API tsc (no SAM deploy).
#   bash "/Volumes/Mac Mini/Coding Projects/Rapid Cortex/scripts/verify-call-assist-phase2-build.sh"
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
unset HTTP_PROXY HTTPS_PROXY http_proxy https_proxy ALL_PROXY all_proxy no_proxy NO_PROXY || true

# shellcheck source=scripts/lib/api-vendor-lock.sh
source "${ROOT}/scripts/lib/api-vendor-lock.sh"
# shellcheck source=scripts/lib/prepare-api-vendor-for-sam.sh
source "${ROOT}/scripts/lib/prepare-api-vendor-for-sam.sh"
rc_acquire_api_vendor_lock
REVERT_API_PKG=0
cleanup() {
  if [[ "${REVERT_API_PKG:-0}" -eq 1 && -f "${ROOT}/apps/api/package.json.pre-call-assist-p2-verify" ]]; then
    mv "${ROOT}/apps/api/package.json.pre-call-assist-p2-verify" "${ROOT}/apps/api/package.json"
  fi
  exec 9>&- 2>/dev/null || true
}
trap cleanup EXIT

echo "▶ Vendor refresh"
RC_API_PKG_BACKUP_SUFFIX=pre-call-assist-p2-verify rc_prepare_api_vendor_for_sam
REVERT_API_PKG="${REVERT_API_PKG:-1}"

echo "▶ Phase 2 unit tests"
npx vitest run \
  packages/shared/src/call-assist/conversation-memory.test.ts \
  packages/shared/src/call-assist/response-generator.test.ts \
  apps/api/src/call-assist/telephony/adaptive-endpointing.test.ts \
  apps/api/src/call-assist/telephony/barge-in.test.ts \
  apps/api/src/call-assist/lex/__tests__/dialog-hook.test.ts

echo "▶ API tsc"
npm run build -w rapid-cortex-api
echo "✅ Call Assist Phase 2 build verify OK"
