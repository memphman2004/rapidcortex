#!/usr/bin/env bash
# Wait for API dry run → execute changeset → web ECS → marketing S3.
# Usage: AWS_PROFILE=rapid-cortex ./scripts/run-post-dryrun-deploy-chain.sh [dry-run-pid]
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

export AWS_PROFILE="${AWS_PROFILE:-rapid-cortex}"
export AWS_REGION="${AWS_REGION:-us-east-1}"
LOG="${DEPLOY_CHAIN_DRY_RUN_LOG:-/tmp/rapid-cortex-changeset-post-iam.log}"
CHAIN_LOG="${DEPLOY_CHAIN_LOG:-/tmp/rapid-cortex-deploy-chain.log}"
DRY_PID="${1:-}"

exec > >(tee -a "${CHAIN_LOG}") 2>&1

echo "════════════════════════════════════════════════════════"
echo " Rapid Cortex post-dry-run deploy chain"
echo " $(date -u +%Y-%m-%dT%H:%MZ) UTC"
echo " AWS_PROFILE=${AWS_PROFILE}"
echo " Log: ${CHAIN_LOG}"
echo "════════════════════════════════════════════════════════"

if ! aws sts get-caller-identity --query Account --output text | grep -q '^158961537080$'; then
  echo "ERROR: Wrong AWS account. export AWS_PROFILE=rapid-cortex first." >&2
  exit 1
fi

if [[ -n "${DRY_PID}" ]] && ps -p "${DRY_PID}" >/dev/null 2>&1; then
  echo "Waiting for dry run PID ${DRY_PID}…"
  while ps -p "${DRY_PID}" >/dev/null 2>&1; do
    sleep 30
  done
fi

if [[ ! -f "${LOG}" ]]; then
  echo "ERROR: Missing dry run log: ${LOG}" >&2
  exit 1
fi

if ! grep -q "Changeset created successfully" "${LOG}"; then
  echo "ERROR: Dry run did not succeed (no 'Changeset created successfully' in ${LOG})." >&2
  tail -40 "${LOG}" >&2 || true
  exit 1
fi

CHANGESET_ARN="$(grep -oE 'arn:aws:cloudformation:[^ ]+changeSet/samcli-deploy[0-9]+/[^ ]+' "${LOG}" | tail -1)"
if [[ -z "${CHANGESET_ARN}" ]]; then
  echo "ERROR: Could not parse changeset ARN from ${LOG}" >&2
  exit 1
fi
CHANGESET_NAME="$(echo "${CHANGESET_ARN}" | sed -n 's|.*/changeSet/\([^/]*\)/.*|\1|p')"
echo "Executing changeset: ${CHANGESET_NAME}"

aws cloudformation execute-change-set \
  --stack-name rapid-cortex-dev \
  --change-set-name "${CHANGESET_NAME}" \
  --region "${AWS_REGION}"

echo "Waiting for stack rapid-cortex-dev…"
for i in $(seq 1 120); do
  STATUS="$(aws cloudformation describe-stacks \
    --stack-name rapid-cortex-dev \
    --region "${AWS_REGION}" \
    --query 'Stacks[0].StackStatus' \
    --output text 2>/dev/null || echo UNKNOWN)"
  echo "  $(date -u +%H:%M:%S) ${STATUS}"
  case "${STATUS}" in
    UPDATE_COMPLETE) break ;;
    UPDATE_ROLLBACK_COMPLETE|UPDATE_FAILED|ROLLBACK_COMPLETE)
      echo "ERROR: Stack update failed: ${STATUS}" >&2
      aws cloudformation describe-stack-events --stack-name rapid-cortex-dev --max-items 15 \
        --query 'StackEvents[?contains(ResourceStatus, `FAILED`)].[LogicalResourceId,ResourceStatusReason]' \
        --output table 2>&1 || true
      exit 1
      ;;
  esac
  sleep 30
done

if [[ "${STATUS:-}" != "UPDATE_COMPLETE" ]]; then
  echo "ERROR: Timed out waiting for UPDATE_COMPLETE (last: ${STATUS:-unknown})" >&2
  exit 1
fi

echo "API deploy complete."

load_web_prod_env() {
  if [[ -f "${ROOT}/scripts/env-web-ssr-prod.sh" ]]; then
    # shellcheck source=/dev/null
    source "${ROOT}/scripts/env-web-ssr-prod.sh"
  fi
  export NEXT_PUBLIC_SITE_URL="${NEXT_PUBLIC_SITE_URL:-https://www.rapidcortex.us}"
  export NEXT_PUBLIC_APP_ORIGIN="${NEXT_PUBLIC_APP_ORIGIN:-https://app.rapidcortex.us}"
  export NEXT_PUBLIC_MARKETING_SITE_URL="${NEXT_PUBLIC_MARKETING_SITE_URL:-https://www.rapidcortex.us}"
  export NEXT_PUBLIC_AUTH_PROXY="${NEXT_PUBLIC_AUTH_PROXY:-1}"
  export API_UPSTREAM_BASE="${API_UPSTREAM_BASE:-https://api.rapidcortex.us}"
  # shellcheck source=scripts/lib/resolve-mapbox-token.sh
  source "${ROOT}/scripts/lib/resolve-mapbox-token.sh"
  resolve_mapbox_token || echo "WARN: Mapbox token not resolved — web deploy may fail."
}

echo ""
echo "Step: Web (app.rapidcortex.us)…"
load_web_prod_env
"${ROOT}/scripts/deploy-web-no-docker.sh" prod

echo ""
echo "Step: Marketing (www.rapidcortex.us)…"
export NEXT_PUBLIC_SITE_URL="${NEXT_PUBLIC_SITE_URL:-https://www.rapidcortex.us}"
export NEXT_PUBLIC_APP_ORIGIN="${NEXT_PUBLIC_APP_ORIGIN:-https://app.rapidcortex.us}"
"${ROOT}/scripts/deploy-marketing.sh" prod

echo ""
echo "Deploy chain finished successfully at $(date -u +%Y-%m-%dT%H:%MZ) UTC."
