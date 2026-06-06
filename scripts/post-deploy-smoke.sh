#!/usr/bin/env bash
set -euo pipefail

# Canonical post-deploy CI smoke hook — runs web curl checks via smoke-web.sh.
# API/Lambda HttpApi checks: scripts/archive/post-deploy-api-smoke.sh (npm run smoke:api)
#
# Usage:
#   ./scripts/post-deploy-smoke.sh [dev|staging|prod|pilot]
#   DEPLOY_STAGE=prod ./scripts/post-deploy-smoke.sh
#
# Optional (forwarded to smoke-web.sh):
#   WEB_SMOKE_BASE_URL, SMOKE_WEB_STACK_NAME, SMOKE_REQUIRE_HEALTH_WEB=1

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
STAGE="${1:-${DEPLOY_STAGE:-${STAGE:-prod}}}"
export DEPLOY_STAGE="${STAGE}" STAGE="${STAGE}"
exec bash "${ROOT}/scripts/smoke-web.sh"
