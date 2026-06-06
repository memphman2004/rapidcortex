#!/usr/bin/env bash
# G4 — Audit scenario narrative tests against a *running* API (optional).
# Requires: API_URL (or BASE_URL), test credentials, and admin JWT for audit reads if restricted.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

API_URL="${API_URL:-${BASE_URL:-}}"
if [[ -z "${API_URL}" ]]; then
  echo "G4 audit scenarios: set API_URL or BASE_URL to the deployment under test, then re-run."
  echo "Copy results into docs/evidence/templates/g4-auditability-evidence.template.md"
  exit 0
fi

echo "=========================================="
echo "G4: Audit scenario tests (live) — $API_URL"
echo "=========================================="
echo "This script is a stub: wire curl/jq flows to your staging auth and audit endpoints,"
echo "or use internal tooling. Repository tests for audit redaction live under apps/api."
echo "=========================================="
