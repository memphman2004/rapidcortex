#!/usr/bin/env bash
# Interactive / infra smoke checks for NexCort Watch MCP.
# Does NOT prove unattended scheduled ChatGPT Watches can call submit_watch_signal.
set -euo pipefail

BASE_URL="${MCP_PUBLIC_BASE_URL:-https://mcp.nexcortiq.us}"
BASE_URL="${BASE_URL%/}"

echo "== health =="
curl -fsS "$BASE_URL/health" | tee /tmp/mcp-watch-health.json
echo

echo "== oauth metadata =="
curl -fsS "$BASE_URL/.well-known/oauth-authorization-server" | tee /tmp/mcp-watch-oauth.json
echo

echo "== jwks =="
curl -fsS "$BASE_URL/.well-known/jwks.json" | tee /tmp/mcp-watch-jwks.json
echo

if [[ -z "${MCP_ACCESS_TOKEN:-}" ]]; then
  echo "MCP_ACCESS_TOKEN unset — skipping authenticated /mcp initialize probe."
  echo "After OAuth login, re-run with MCP_ACCESS_TOKEN=… to exercise Streamable HTTP."
  exit 0
fi

echo "== mcp initialize (Streamable HTTP) =="
curl -fsS -X POST "$BASE_URL/mcp" \
  -H "Authorization: Bearer $MCP_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"smoke","version":"1.0.0"}}}' \
  | tee /tmp/mcp-watch-initialize.json
echo

echo "Smoke HTTP checks finished."
echo "SEPARATE ACCEPTANCE: scheduled ChatGPT Watch → submit_watch_signal unattended write is NOT covered here."
