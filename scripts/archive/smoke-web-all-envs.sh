#!/usr/bin/env bash
set -euo pipefail
#
# Run scripts/smoke-web.sh for each deploy stage (default: dev, staging, prod).
# Resolves base URL per stage via CloudFormation unless a per-stage URL is set.
#
# Usage:
#   ./scripts/smoke-web-all-envs.sh
#   SMOKE_WEB_ENVS="dev prod" ./scripts/smoke-web-all-envs.sh
#
# Optional per-stage URLs (override CF for that stage only):
#   WEB_SMOKE_BASE_URL_DEV=… WEB_SMOKE_BASE_URL_STAGING=… WEB_SMOKE_BASE_URL_PROD=…
#
# Other env vars are forwarded by inheritance: AWS_REGION, SMOKE_TIMEOUT_SECONDS,
# SMOKE_WEB_STACK_NAME (applies to all runs — prefer explicit smoke-web.sh if you need
# different stacks per stage).
#
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SMOKE_SCRIPT="${ROOT}/scripts/smoke-web.sh"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

usage() {
  echo "Usage: $0 [--help]"
  echo ""
  echo "Runs ${SMOKE_SCRIPT} once per stage in SMOKE_WEB_ENVS (default: dev staging prod)."
  echo "Each run sets DEPLOY_STAGE/STAGE and resolves the host from CloudFormation unless"
  echo "WEB_SMOKE_BASE_URL_<STAGE> is set (e.g. WEB_SMOKE_BASE_URL_PROD)."
  echo ""
  echo "Exit 1 if any stage fails. Set SMOKE_WEB_ALL_CONTINUE=1 to run every stage"
  echo "even after failures (still exits 1 if any failed)."
  exit 0
}

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  usage
fi

if [[ ! -f "${SMOKE_SCRIPT}" ]]; then
  echo "Missing smoke script: ${SMOKE_SCRIPT}" >&2
  exit 1
fi

read -r -a ENVS <<< "${SMOKE_WEB_ENVS:-dev staging prod}"
CONTINUE="${SMOKE_WEB_ALL_CONTINUE:-0}"

per_stage_base_url() {
  case "$1" in
    dev) echo "${WEB_SMOKE_BASE_URL_DEV:-}" ;;
    staging) echo "${WEB_SMOKE_BASE_URL_STAGING:-}" ;;
    prod) echo "${WEB_SMOKE_BASE_URL_PROD:-}" ;;
    *) echo "" ;;
  esac
}

echo "Running smoke tests across environments: ${ENVS[*]}"
echo ""

FAILED_STAGES=()
for stage in "${ENVS[@]}"; do
  echo "────────────────────────────────────────────────────────"
  echo -e " ${YELLOW}Stage:${NC} ${stage}"
  echo "────────────────────────────────────────────────────────"

  pe_url="$(per_stage_base_url "${stage}")"
  set +e
  if [[ -n "${pe_url}" ]]; then
    WEB_SMOKE_BASE_URL="${pe_url}" DEPLOY_STAGE="${stage}" STAGE="${stage}" bash "${SMOKE_SCRIPT}"
    rc=$?
  else
    (
      unset WEB_SMOKE_BASE_URL
      export DEPLOY_STAGE="${stage}" STAGE="${stage}"
      exec bash "${SMOKE_SCRIPT}"
    )
    rc=$?
  fi
  set -e

  if [[ "${rc}" -ne 0 ]]; then
    echo -e "${RED}✗${NC} Smoke failed for stage: ${stage} (exit ${rc})"
    FAILED_STAGES+=("${stage}")
    if [[ "${CONTINUE}" != "1" ]]; then
      echo ""
      echo -e "${RED}Stopping (set SMOKE_WEB_ALL_CONTINUE=1 to run remaining stages).${NC}"
      exit 1
    fi
  else
    echo -e "${GREEN}✓${NC} Smoke passed for stage: ${stage}"
  fi
  echo ""
done

echo "════════════════════════════════════════════════════════"
echo " All-environment summary"
echo "════════════════════════════════════════════════════════"
echo " Stages run: ${ENVS[*]}"
if [[ "${#FAILED_STAGES[@]}" -eq 0 ]]; then
  echo -e " ${GREEN}All stages passed.${NC}"
  exit 0
fi

echo -e " ${RED}Failed stages: ${FAILED_STAGES[*]}${NC}"
exit 1
