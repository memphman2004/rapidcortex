#!/usr/bin/env bash
# Operational runbook: unblock Silent Text, Pinpoint SMS, Live Video invite SMS, and map UI for pilot QA.
# Run sections manually in order. Requires AWS CLI + prod/dev credentials.
#
# Priority: Blocker 1 (web flags + ALS maps) → Blocker 2 (API redeploy) → E2E test
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REGION="${AWS_REGION:-us-east-1}"
API_STACK="${API_STACK:-rapid-cortex-dev}"

section() {
  echo ""
  echo "══════════════════════════════════════════════════════════════"
  echo "$1"
  echo "══════════════════════════════════════════════════════════════"
}

usage() {
  sed -n '2,8p' "$0"
  echo ""
  echo "Usage:"
  echo "  $0 deploy-web-prod        # Blocker 1 — source env + CodeBuild/ECS deploy"
  echo "  $0 api-stack-failure      # Blocker 2 — print last UPDATE_FAILED events"
  echo "  $0 deploy-api-dev         # Blocker 2 — redeploy API after SAM fix"
  echo "  $0 e2e-hints              # print curl/aws commands for manual E2E"
}

cmd_deploy_web_prod() {
  section "Blocker 1 — deploy web with Pinpoint + Live Video + ALS map flags"
  if [[ -z "${NEXT_PUBLIC_ALS_IDENTITY_POOL_ID:-}" ]]; then
    echo "WARN: NEXT_PUBLIC_ALS_IDENTITY_POOL_ID is unset — map tiles will not authenticate until AppSamLocationStack2 is deployed." >&2
  fi
  # shellcheck source=scripts/env-web-ssr-prod.sh
  source "${ROOT}/scripts/env-web-ssr-prod.sh"
  echo "NEXT_PUBLIC_ENABLE_PINPOINT=${NEXT_PUBLIC_ENABLE_PINPOINT:-?}"
  echo "NEXT_PUBLIC_ENABLE_LIVE_VIDEO=${NEXT_PUBLIC_ENABLE_LIVE_VIDEO:-?}"
  echo "NEXT_PUBLIC_ENABLE_SILENT_TEXT=${NEXT_PUBLIC_ENABLE_SILENT_TEXT:-?}"
  echo "NEXT_PUBLIC_ALS_IDENTITY_POOL_ID set: $([[ -n "${NEXT_PUBLIC_ALS_IDENTITY_POOL_ID:-}" ]] && echo yes || echo no)"
  "${ROOT}/scripts/deploy-web-no-docker.sh" prod
}

cmd_api_stack_failure() {
  section "Blocker 2 — last API stack failures (${API_STACK})"
  aws cloudformation describe-stacks \
    --stack-name "${API_STACK}" \
    --region "${REGION}" \
    --query 'Stacks[0].StackStatus' \
    --output text
  echo ""
  aws cloudformation describe-stack-events \
    --stack-name "${API_STACK}" \
    --region "${REGION}" \
    --query 'StackEvents[?ResourceStatus==`UPDATE_FAILED`].[Timestamp,LogicalResourceId,ResourceStatusReason]' \
    --output table \
    --max-items 15
  echo ""
  echo "Known fix (2026-06-13 rollback): nested AppSam2–5 failed with"
  echo "  Parameters: [NonEmergencyQueueTable] do not exist in the template"
  echo "Ensure NonEmergencyQueueTable is only passed to AppSamStackV2 (stack-app-sam.yaml), not stacks 2–5."
  echo "Then: source scripts/env-api-dev.sh && ./scripts/deploy.sh dev"
}

cmd_deploy_api_dev() {
  section "Blocker 2 — redeploy API (dev/prod SAM stack)"
  # shellcheck source=scripts/env-api-dev.sh
  source "${ROOT}/scripts/env-api-dev.sh"
  "${ROOT}/scripts/deploy.sh" dev
}

cmd_e2e_hints() {
  section "E2E test sequence (manual — use test phone you control)"
  cat <<'EOF'
# 1. AWS SMS origination (End User Messaging)
./scripts/setup-aws-10dlc.sh status

# 2. Cognito token (set RC_TEST_PASSWORD)
TOKEN="$(aws cognito-idp initiate-auth \
  --region us-east-1 \
  --auth-flow USER_PASSWORD_AUTH \
  --client-id "${COGNITO_CLIENT_ID:-7moi6sgc2uf4o31omgvo77h3v5}" \
  --auth-parameters USERNAME=rcsuperadmin@appsondemand.net,PASSWORD="${RC_TEST_PASSWORD}" \
  --query 'AuthenticationResult.IdToken' --output text)"

# 3. Silent text session (Stack 5 API base — adjust if using custom domain)
INCIDENT_ID="test-$(date +%s)"
curl -s -X POST \
  "${API_UPSTREAM_BASE_5:-https://YOUR_STACK5_API}/api/incidents/${INCIDENT_ID}/silent-text" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"callerPhone":"+1YOUR_TEST_NUMBER","agencyId":"test-agency"}' | jq .

# 4. Audit trail
aws dynamodb query \
  --table-name rapid-cortex-audit-dev \
  --region us-east-1 \
  --key-condition-expression "agencyId = :aid" \
  --filter-expression "contains(#t, :evt)" \
  --expression-attribute-names '{"#t":"type"}' \
  --expression-attribute-values '{":aid":{"S":"test-agency"},":evt":{"S":"silent"}}' \
  --max-items 5

# 5. KVS streams (live video)
aws kinesisvideo list-streams --region us-east-1 \
  --query 'StreamInfoList[?contains(StreamName, `lvsv`)].{Name:StreamName,Status:Status}' \
  --output table
EOF
}

main="${1:-usage}"
case "${main}" in
  deploy-web-prod) cmd_deploy_web_prod ;;
  api-stack-failure) cmd_api_stack_failure ;;
  deploy-api-dev) cmd_deploy_api_dev ;;
  e2e-hints) cmd_e2e_hints ;;
  usage|-h|--help|*) usage ;;
esac
