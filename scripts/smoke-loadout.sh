#!/usr/bin/env bash
# NexCortiQ Loadout smoke test — external REST API (API key authorizer)
# Requires: LOADOUT_API_KEY (from provision/seed), LOADOUT_API_URL (CF LoadoutApiEndpoint)
set -euo pipefail

API="${LOADOUT_API_URL:?Set LOADOUT_API_URL}"
KEY="${LOADOUT_API_KEY:?Set LOADOUT_API_KEY}"

echo "[smoke-loadout] Testing licensed endpoint..."
STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$API/v1/transcribe" \
  -H "x-api-key: $KEY" -H "Content-Type: application/json" \
  -d '{"audioData":"dGVzdA==","language":"en-US"}')
if [[ "$STATUS" = "200" || "$STATUS" = "422" ]]; then
  echo "[smoke-loadout] Licensed endpoint: $STATUS"
else
  echo "[smoke-loadout] FAIL licensed expected 200|422 got $STATUS" >&2
  exit 1
fi

echo "[smoke-loadout] Testing unlicensed endpoint returns 403..."
STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$API/v1/translate" \
  -H "x-api-key: $KEY" -H "Content-Type: application/json" \
  -d '{"text":"hello"}')
if [[ "$STATUS" = "403" ]]; then
  echo "[smoke-loadout] Unlicensed endpoint correctly returns 403"
else
  echo "[smoke-loadout] FAIL unlicensed expected 403 got $STATUS" >&2
  exit 1
fi

echo "[smoke-loadout] Testing invalid key returns 401..."
STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$API/v1/transcribe" \
  -H "x-api-key: ncq_live_invalidkey123invalidkey123invalid" -H "Content-Type: application/json" \
  -d '{"audioData":"dGVzdA=="}')
if [[ "$STATUS" = "401" || "$STATUS" = "403" ]]; then
  echo "[smoke-loadout] Invalid key correctly returns $STATUS"
else
  echo "[smoke-loadout] FAIL invalid key expected 401|403 got $STATUS" >&2
  exit 1
fi

echo "[smoke-loadout] All checks passed."
