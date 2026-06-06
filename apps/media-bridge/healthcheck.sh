#!/usr/bin/env bash
set -euo pipefail

if [[ ! -f /tmp/bridge.pid ]]; then
  exit 1
fi
PID="$(< /tmp/bridge.pid)"
if ! kill -0 "$PID" 2>/dev/null; then
  exit 1
fi
exit 0
