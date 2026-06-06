#!/usr/bin/env bash
# Lightweight synthetic check for schedulers (cron, EventBridge, CI).
# Calls public health endpoint; exits non-zero on failure.
# Usage:
#   API_BASE_URL=https://xxxx.execute-api....amazonaws.com ./scripts/synthetic-api-health.sh
# Or pass URL as first argument.
set -euo pipefail
BASE="${1:-${API_BASE_URL:-}}"
if [[ -z "$BASE" ]]; then
  echo "Usage: API_BASE_URL=https://... $0   or   $0 https://..." >&2
  exit 1
fi
BASE="${BASE%/}"
code="$(curl -sS -o /tmp/rc-synthetic-health.json -w "%{http_code}" "${BASE}/api/health")"
if [[ "$code" != "200" ]]; then
  echo "synthetic health FAIL: HTTP ${code}" >&2
  cat /tmp/rc-synthetic-health.json >&2 || true
  exit 1
fi
if ! python3 -c "import json; d=json.load(open('/tmp/rc-synthetic-health.json')); assert d.get('status')=='ok' and d.get('service')=='rapid-cortex-api'" 2>/dev/null; then
  echo "synthetic health FAIL: body missing expected JSON fields" >&2
  cat /tmp/rc-synthetic-health.json >&2
  exit 1
fi
echo "synthetic health OK (${BASE}/api/health)"
