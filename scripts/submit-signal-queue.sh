#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# submit-signal-queue.sh
#
# Local relay for the NexiQ signal discovery pipeline.
#
# PURPOSE
#   The Cursor cloud agent that runs the daily signal discovery cannot POST
#   to tbr4zvjlk5.execute-api.us-east-1.amazonaws.com because the Cursor
#   cloud sandbox egress proxy blocks AWS API Gateway domains.
#
#   This script runs locally and submits a JSON queue file (array of
#   RapidIqWatchIngestBody objects) to the watch-ingest endpoint.
#
# USAGE
#   # Submit a saved queue file:
#   bash scripts/submit-signal-queue.sh /path/to/signal-queue.json
#
#   # Submit from user personal store (default path the automation writes to):
#   bash scripts/submit-signal-queue.sh
#
#   # Dry-run (validate payloads, do not POST):
#   DRY_RUN=1 bash scripts/submit-signal-queue.sh
#
# QUEUE FILE FORMAT
#   A JSON array of RapidIqWatchIngestBody objects, e.g.:
#   [
#     {
#       "source": "civiciq",
#       "watch": "PSAP 911 Communications Software",
#       "external_key": "civiciq-rfp-ga-2026-1234",
#       "signal_type": "rfp",
#       "vertical": "911_psap",
#       "agency": { "name": "...", "state": "GA" },
#       "opportunity": {
#         "title": "...",
#         "procurement_url": "...",
#         "due_date": "2026-12-04"
#       }
#     }
#   ]
#
# NexCort iQ notes:
#   STAGE=dev is live production (rapid-cortex-dev), not a sandbox.
#   API endpoint is Stack 3 (AppSam3Stack): tbr4zvjlk5.execute-api.us-east-1.amazonaws.com
# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail

REGION="${REGION:-us-east-1}"
AWS_PROFILE="${AWS_PROFILE:-rapid-cortex}"
API_BASE="${RAPID_IQ_API_BASE:-https://tbr4zvjlk5.execute-api.us-east-1.amazonaws.com}"
ENDPOINT="${API_BASE}/api/rapid-iq/pipeline/watch-ingest"
SECRET_ARN="${RAPID_IQ_WATCH_INGEST_API_KEY_SECRET_ARN:-arn:aws:secretsmanager:us-east-1:158961537080:secret:rapid-cortex/rapid-iq/watch-ingest-api-key-oT0am2}"

# Default queue path: user personal agent store (matches what the automation writes)
DEFAULT_QUEUE="${SIGNAL_QUEUE_FILE:-$HOME/Library/Application Support/Cursor/AgentStores/cursor_agent_stores/u191955696/files/signal-queue.json}"
QUEUE_FILE="${1:-$DEFAULT_QUEUE}"

DRY_RUN="${DRY_RUN:-0}"

echo "═══════════════════════════════════════════════════════════"
echo " NexiQ Signal Queue — Local Relay Submission"
echo " Endpoint: $ENDPOINT"
echo " Queue:    $QUEUE_FILE"
[ "$DRY_RUN" = "1" ] && echo " ⚠️  DRY RUN — payloads validated but NOT submitted"
echo "═══════════════════════════════════════════════════════════"
echo ""

# ── Resolve API key ───────────────────────────────────────────────────────────
echo "▶ Resolving watch-ingest API key..."

if [[ -n "${RAPID_IQ_WATCH_INGEST_API_KEY:-}" ]]; then
  API_KEY="$RAPID_IQ_WATCH_INGEST_API_KEY"
  echo "  Using inline env var API key"
else
  API_KEY=$(AWS_PROFILE="$AWS_PROFILE" aws secretsmanager get-secret-value \
    --region "$REGION" \
    --secret-id "$SECRET_ARN" \
    --query "SecretString" \
    --output text 2>/dev/null | python3 -c '
import json, sys
raw = sys.stdin.read().strip()
if not raw or raw == "None":
    sys.exit(1)
try:
    obj = json.loads(raw)
    print(obj.get("apiKey", obj.get("key", raw)), end="")
except json.JSONDecodeError:
    print(raw, end="")
' 2>/dev/null) || true

  if [[ -z "$API_KEY" ]]; then
    echo "  ❌  Could not resolve API key from $SECRET_ARN"
    echo "      Set RAPID_IQ_WATCH_INGEST_API_KEY=<key> and retry"
    exit 1
  fi
  echo "  ✅  API key resolved from Secrets Manager"
fi

# ── Load queue file ───────────────────────────────────────────────────────────
echo ""
echo "▶ Loading queue file..."

if [[ ! -f "$QUEUE_FILE" ]]; then
  echo "  ❌  Queue file not found: $QUEUE_FILE"
  echo ""
  echo "  To create a queue file manually, write a JSON array of signals:"
  echo "    bash scripts/submit-signal-queue.sh /path/to/my-signals.json"
  echo ""
  echo "  Or run the signal discovery pipeline locally:"
  echo "    # (uses Civic IQ MCP or manual list — see claude/ prompt docs)"
  exit 1
fi

SIGNAL_COUNT=$(python3 -c "
import json, sys
with open('$QUEUE_FILE') as f:
    data = json.load(f)
if isinstance(data, list):
    print(len(data))
elif isinstance(data, dict):
    print(1)
else:
    print(0)
" 2>/dev/null) || SIGNAL_COUNT=0

if [[ "$SIGNAL_COUNT" -eq 0 ]]; then
  echo "  ⚠️   Queue file is empty or invalid JSON — nothing to submit"
  exit 0
fi

echo "  ✅  $SIGNAL_COUNT signal(s) loaded"

# ── Validate structure ────────────────────────────────────────────────────────
echo ""
echo "▶ Validating payload structure..."

VALIDATION=$(python3 -c "
import json, sys

REQUIRED_FIELDS = ['source', 'watch', 'external_key', 'signal_type', 'vertical', 'agency', 'opportunity']
VALID_SOURCES = ['chatgpt_watch', 'civiciq', 'sam_gov', 'bidnet', 'state_portal', 'manual_import', 'internal_crawler']
VALID_SIGNAL_TYPES = ['rfp', 'planning', 'funded', 'early_signal', 'competitor']
VALID_VERTICALS = ['911_psap', 'campus', 'venue', 'transit', 'competitors', 'law_enforcement']

with open('$QUEUE_FILE') as f:
    data = json.load(f)

items = data if isinstance(data, list) else [data]
errors = []

for i, item in enumerate(items):
    for field in REQUIRED_FIELDS:
        if field not in item:
            errors.append(f'Item {i}: missing required field: {field}')
    if item.get('source') not in VALID_SOURCES:
        errors.append(f'Item {i}: invalid source: {item.get(\"source\")}')
    if item.get('signal_type') not in VALID_SIGNAL_TYPES:
        errors.append(f'Item {i}: invalid signal_type: {item.get(\"signal_type\")}')
    if item.get('vertical') not in VALID_VERTICALS:
        errors.append(f'Item {i}: invalid vertical: {item.get(\"vertical\")}')
    if not isinstance(item.get('agency'), dict):
        errors.append(f'Item {i}: agency must be an object')
    if not isinstance(item.get('opportunity'), dict):
        errors.append(f'Item {i}: opportunity must be an object')
    opp = item.get('opportunity', {})
    if not opp.get('procurement_url'):
        errors.append(f'Item {i}: opportunity.procurement_url is required')

for e in errors:
    print(f'ERROR: {e}')
print(f'VALID_COUNT={len(items) - len([e for e in errors if e.startswith(\"Item\")])}')
" 2>&1) || true

echo "$VALIDATION" | grep "ERROR:" && { echo "  ❌  Validation errors found above. Fix and retry."; exit 1; } || true
echo "  ✅  All items valid"

# ── Submit ────────────────────────────────────────────────────────────────────
echo ""
if [[ "$DRY_RUN" = "1" ]]; then
  echo "  ✅  Dry run complete — $SIGNAL_COUNT signal(s) validated, NOT submitted"
  exit 0
fi

echo "▶ Submitting $SIGNAL_COUNT signal(s)..."

# Submit as a batch (up to 25 per request, as the schema allows)
python3 - <<PYEOF
import json, urllib.request, urllib.error, sys, math

with open('$QUEUE_FILE') as f:
    data = json.load(f)

items = data if isinstance(data, list) else [data]
api_key = '$API_KEY'
endpoint = '$ENDPOINT'
batch_size = 25

submitted = 0
failed = 0

for batch_start in range(0, len(items), batch_size):
    batch = items[batch_start : batch_start + batch_size]
    payload = json.dumps(batch).encode('utf-8')

    req = urllib.request.Request(
        endpoint,
        data=payload,
        headers={
            'Content-Type': 'application/json',
            'x-nexcort-watch-key': api_key,
        },
        method='POST',
    )

    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            body = json.loads(resp.read().decode('utf-8'))
            results = body.get('results', [body] if not isinstance(body, list) else body)
            batch_ok = sum(1 for r in results if r.get('success'))
            batch_fail = len(batch) - batch_ok
            submitted += batch_ok
            failed += batch_fail
            print(f'  Batch {batch_start//batch_size + 1}: {batch_ok} submitted, {batch_fail} failed')
            for r in results:
                action = r.get('action', '?')
                ext_key = r.get('external_key', '?')
                if r.get('success'):
                    print(f'    ✅  [{action}] {ext_key}')
                else:
                    print(f'    ❌  {ext_key}: {r.get("error", "unknown")}')
    except urllib.error.HTTPError as e:
        body = e.read().decode('utf-8', errors='replace')
        print(f'  ❌  HTTP {e.code} for batch {batch_start//batch_size + 1}: {body[:200]}')
        failed += len(batch)
    except Exception as e:
        print(f'  ❌  Exception for batch {batch_start//batch_size + 1}: {e}')
        failed += len(batch)

print()
print(f'  Results: {submitted} submitted ✅   {failed} failed ❌')
if failed == 0:
    print('  🎉  All signals delivered successfully')
sys.exit(0 if failed == 0 else 1)
PYEOF

# ── Archive submitted queue ───────────────────────────────────────────────────
if [[ $? -eq 0 && "$QUEUE_FILE" == *"/u191955696/files/signal-queue.json" ]]; then
  ARCHIVE="${QUEUE_FILE%.json}-$(date '+%Y%m%d-%H%M%S').json"
  mv "$QUEUE_FILE" "$ARCHIVE"
  echo ""
  echo "  Queue archived → $ARCHIVE"
fi
