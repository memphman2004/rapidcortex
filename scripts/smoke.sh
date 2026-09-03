#!/usr/bin/env bash
set -euo pipefail

# Shell smoke entrypoint — delegates to canonical post-deploy web smoke hook.
# Usage:
#   ./scripts/smoke.sh [dev|staging|prod|pilot]
#   ./scripts/smoke.sh --vertical transit
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
if [[ "${1:-}" == "--vertical" && "${2:-}" == "transit" ]]; then
  exec bash "${ROOT}/scripts/smoke-transit.sh"
fi
exec bash "${ROOT}/scripts/post-deploy-smoke.sh" "$@"
