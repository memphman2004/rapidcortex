#!/usr/bin/env bash
# Smoke-test ChatGPT Watch → NexiQ Inbox ingest after secret + deploy.
#
# Usage:
#   export RAPID_IQ_WATCH_INGEST_API_KEY='…'   # from create-watch-ingest-secret.sh
#   export API_BASE='https://tbr4zvjlk5.execute-api.us-east-1.amazonaws.com'  # HttpApi3
#   bash scripts/smoke-watch-ingest.sh
#
# Note: api.rapidcortex.us maps to HttpApi1 only — watch-ingest lives on HttpApi3.
set -euo pipefail

API_BASE="${API_BASE:-https://tbr4zvjlk5.execute-api.us-east-1.amazonaws.com}"
KEY="${RAPID_IQ_WATCH_INGEST_API_KEY:-${WATCH_INGEST_API_KEY:-}}"
if [[ -z "${KEY}" ]]; then
  echo "Set RAPID_IQ_WATCH_INGEST_API_KEY to the apiKey from create-watch-ingest-secret.sh" >&2
  exit 1
fi

EXT_KEY="SMOKE|WatchIngest|$(date -u +%Y%m%d%H%M%S)"
URL="${API_BASE%/}/api/rapid-iq/pipeline/watch-ingest"

echo "POST ${URL}"
echo "external_key=${EXT_KEY}"

RESP="$(curl -sS -w "\n%{http_code}" -X POST "${URL}" \
  -H "Content-Type: application/json" \
  -H "x-nexcort-watch-key: ${KEY}" \
  -d "$(cat <<EOF
{
  "source": "chatgpt_watch",
  "watch": "psap_rfp",
  "external_key": "${EXT_KEY}",
  "signal_type": "rfp",
  "vertical": "911_psap",
  "agency": { "name": "Watch Ingest Smoke Test", "city": null, "state": "GA" },
  "opportunity": {
    "title": "Smoke test — dismiss after verifying Inbox",
    "solicitation_number": null,
    "posted_date": "$(date -u +%Y-%m-%d)",
    "due_date": null,
    "estimated_value": null,
    "procurement_url": "https://example.gov/nexcort-watch-smoke/${EXT_KEY}",
    "status": "open"
  },
  "qualification": { "fit": "low", "strategy": "monitor", "reason": "Automated smoke test" },
  "next_action": "Dismiss this card in NexiQ Watch Feed",
  "evidence": [{ "url": "https://example.gov/nexcort-watch-smoke/${EXT_KEY}", "source_type": "other" }]
}
EOF
)")"

BODY="$(echo "${RESP}" | sed '$d')"
CODE="$(echo "${RESP}" | tail -n1)"
echo "HTTP ${CODE}"
echo "${BODY}" | python3 -m json.tool 2>/dev/null || echo "${BODY}"

if [[ "${CODE}" != "200" ]]; then
  echo "Smoke failed — check secret ARN on SignalHttp, EnableRapidIqNewHttpRoutes, and API_BASE." >&2
  exit 1
fi

echo ""
echo "OK — open NexiQ IQ → Watch Feed and dismiss the smoke card (${EXT_KEY})."
