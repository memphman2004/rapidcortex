#!/usr/bin/env bash
# Surgical RC Admin PSAP Prospect CRM API for rapid-cortex-dev (AppSam3 HttpApi).
# Adds /api/rc-admin/psap-prospects/* without a full AppSam3 / root stack deploy.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

# shellcheck source=scripts/env-api-dev.sh
source "${ROOT}/scripts/env-api-dev.sh"
export AWS_PROFILE="${AWS_PROFILE:-rapid-cortex}"
export AWS_REGION="${AWS_REGION:-us-east-1}"
export AWS_DEFAULT_REGION="${AWS_DEFAULT_REGION:-$AWS_REGION}"
export NODE_OPTIONS="${NODE_OPTIONS:---max-old-space-size=8192}"

# Prefer caller override (e.g. /tmp) — env-api-dev.sh may set a shared Mac Mini path.
SAM_BUILD_DIR="${PSAP_CRM_SAM_BUILD_DIR:-${SAM_BUILD_DIR:-/tmp/rc-sam-psap-crm-$(date +%Y%m%d-%H%M%S)}}"
mkdir -p "${SAM_BUILD_DIR}"
export SAM_BUILD_DIR
echo "SAM_BUILD_DIR=${SAM_BUILD_DIR}"

# shellcheck source=scripts/lib/api-vendor-lock.sh
source "${ROOT}/scripts/lib/api-vendor-lock.sh"
# shellcheck source=scripts/lib/prepare-api-vendor-for-sam.sh
source "${ROOT}/scripts/lib/prepare-api-vendor-for-sam.sh"

rc_acquire_api_vendor_lock
REVERT_API_PKG=1
restore_api_pkg() {
  if [[ "${REVERT_API_PKG}" -eq 1 ]]; then
    if [[ -f "${ROOT}/apps/api/package.json.pre-lean" ]]; then
      mv "${ROOT}/apps/api/package.json.pre-lean" "${ROOT}/apps/api/package.json"
    else
      git -C "${ROOT}" checkout HEAD -- apps/api/package.json 2>/dev/null || true
    fi
  fi
  rc_release_api_vendor_lock 2>/dev/null || true
}
trap restore_api_pkg EXIT

RC_API_PKG_BACKUP_SUFFIX=pre-lean rc_prepare_api_vendor_for_sam

if [[ ! -f "${ROOT}/apps/api/dist/handlers/rc-admin/psapProspectsHttp.js" ]]; then
  echo "── Compiling PSAP CRM handlers ──"
  npm run build -w rapid-cortex-api || true
fi
if [[ ! -f "${ROOT}/apps/api/dist/handlers/rc-admin/psapProspectsHttp.js" ]]; then
  echo "ERROR: psapProspectsHttp dist missing after build" >&2
  exit 1
fi
echo "── Using apps/api/dist/handlers/rc-admin/psapProspectsHttp.js ──"

TEMPLATE="${ROOT}/infra/nested/stack-app-sam-3-psap-crm.yaml"
sam validate --lint --template-file "${TEMPLATE}"

sam build \
  --template-file "${TEMPLATE}" \
  --build-dir "${SAM_BUILD_DIR}" \
  --no-cached \
  --parallel \
  --build-in-source

STACK_NAME="${PSAP_CRM_API_STACK_NAME:-rapid-cortex-dev-AppSamPsapCrmStack}"
HTTP_API_ID="${PSAP_CRM_HTTP_API_ID:-tbr4zvjlk5}"
# Empty = routes without gateway JWT (Lambda still validates via getUserContext).
# Do NOT pass HttpApiJwtAuthorizerId= when empty — SAM rejects empty override values.
JWT_AUTHORIZER_ID="${PSAP_CRM_JWT_AUTHORIZER_ID:-}"

PARAM_OVERRIDES=(
  DeploymentStage=dev
  "HttpApiId=${HTTP_API_ID}"
  PsapProspectsTable=rapid-cortex-psap-prospects-dev
  AuditTable=rapid-cortex-audit-dev
  AgenciesTable=rapid-cortex-agencies-dev
  IncidentsTable=rapid-cortex-incidents-dev
  TranscriptsTable=rapid-cortex-transcripts-dev
  AnalysesTable=rapid-cortex-analyses-dev
  InvitesTable=rapid-cortex-invites-dev
  AssetsBucket=rapid-cortex-assets-dev-158961537080
  ImportedCognitoUserPoolId=us-east-1_0z6tA6WBs
  ImportedCognitoWebClientId=7moi6sgc2uf4o31omgvo77h3v5
  ManagedPolicyNamePrefix=rapid-cortex-dev
)
if [[ -n "${JWT_AUTHORIZER_ID}" ]]; then
  PARAM_OVERRIDES+=("HttpApiJwtAuthorizerId=${JWT_AUTHORIZER_ID}")
fi
# Always pass Hunter/Apollo ARNs. Empty nested-stack defaults skip enrichment
# (lastEnrichedAt updates with zero contacts).
RAPID_IQ_HUNTER_API_KEY_SECRET_ARN="${RAPID_IQ_HUNTER_API_KEY_SECRET_ARN:-arn:aws:secretsmanager:us-east-1:158961537080:secret:rapid-cortex/rapid-iq/hunter-api-key-LXEwMX}"
RAPID_IQ_APOLLO_API_KEY_SECRET_ARN="${RAPID_IQ_APOLLO_API_KEY_SECRET_ARN:-arn:aws:secretsmanager:us-east-1:158961537080:secret:rapid-cortex/rapid-iq/apollo-api-key-BDql0e}"
PARAM_OVERRIDES+=("RapidIqHunterApiKeySecretArn=${RAPID_IQ_HUNTER_API_KEY_SECRET_ARN}")
PARAM_OVERRIDES+=("RapidIqApolloApiKeySecretArn=${RAPID_IQ_APOLLO_API_KEY_SECRET_ARN}")
if [[ -n "${CONTACT_COMPANIES_TABLE:-}" ]]; then
  PARAM_OVERRIDES+=("ContactCompaniesTable=${CONTACT_COMPANIES_TABLE}")
fi
if [[ -n "${CONTACT_PERSONS_TABLE:-}" ]]; then
  PARAM_OVERRIDES+=("ContactPersonsTable=${CONTACT_PERSONS_TABLE}")
fi

export SAM_NODE_MODULES_HARDLINK="${SAM_NODE_MODULES_HARDLINK:-1}"

sam deploy \
  --template-file "${SAM_BUILD_DIR}/template.yaml" \
  --stack-name "${STACK_NAME}" \
  --capabilities CAPABILITY_IAM CAPABILITY_NAMED_IAM CAPABILITY_AUTO_EXPAND \
  --resolve-s3 \
  --no-confirm-changeset \
  --no-fail-on-empty-changeset \
  --region "${AWS_REGION}" \
  --parameter-overrides "${PARAM_OVERRIDES[@]}"

echo "PSAP CRM API stack status:"
aws cloudformation describe-stacks --stack-name "${STACK_NAME}" \
  --query 'Stacks[0].StackStatus' --output text

echo "PSAP routes on ${HTTP_API_ID}:"
aws apigatewayv2 get-routes --api-id "${HTTP_API_ID}" \
  --query 'Items[?contains(RouteKey, `psap-prospects`)].[RouteKey,AuthorizationType]' \
  --output table
