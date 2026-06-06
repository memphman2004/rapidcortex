#!/usr/bin/env bash
# Compatibility shim — one-time migration archived in scripts/archive/.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
exec bash "${ROOT}/scripts/archive/migrate-cognito-roles.sh" "$@"
