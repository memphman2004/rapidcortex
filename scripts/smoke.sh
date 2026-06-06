#!/usr/bin/env bash
set -euo pipefail

# Shell smoke entrypoint — delegates to canonical post-deploy web smoke hook.
# Usage: ./scripts/smoke.sh [dev|staging|prod|pilot]
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
exec bash "${ROOT}/scripts/post-deploy-smoke.sh" "$@"
