#!/usr/bin/env bash
# Surgical Rapid IQ API for rapid-cortex-dev (AppSam3 HttpApi).
# Creates Dynamo tables if missing, deploys nested Rapid IQ stack, seeds data.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

# shellcheck source=scripts/env-api-dev.sh
source "${ROOT}/scripts/env-api-dev.sh"
export AWS_PROFILE="${AWS_PROFILE:-rapid-cortex}"
export AWS_REGION="${AWS_REGION:-us-east-1}"
export AWS_DEFAULT_REGION="${AWS_DEFAULT_REGION:-$AWS_REGION}"
export NODE_OPTIONS="${NODE_OPTIONS:---max-old-space-size=8192}"

SAM_BUILD_DIR="${RAPID_IQ_SAM_BUILD_DIR:-/Volumes/Mac Mini/.sam-lean-build/rapid-iq-$(date +%Y%m%d-%H%M%S)}"
mkdir -p "${SAM_BUILD_DIR}"
export SAM_BUILD_DIR
# Same-volume hardlinks avoid multi-GB rsync of node_modules (USB/external builds).
export SAM_NODE_MODULES_HARDLINK="${SAM_NODE_MODULES_HARDLINK:-1}"
echo "SAM_BUILD_DIR=${SAM_BUILD_DIR}"
echo "SAM_NODE_MODULES_HARDLINK=${SAM_NODE_MODULES_HARDLINK}"

ensure_table() {
  local name="$1"
  shift
  if aws dynamodb describe-table --table-name "${name}" >/dev/null 2>&1; then
    echo "── Table exists: ${name}"
    return 0
  fi
  echo "── Creating ${name} ──"
  aws dynamodb create-table --table-name "${name}" --billing-mode PAY_PER_REQUEST "$@"
  aws dynamodb wait table-exists --table-name "${name}"
  echo "── Ready: ${name}"
}

OPP_TABLE="${RAPID_IQ_OPPORTUNITIES_TABLE:-rapid-cortex-rapid-iq-opportunities-dev}"
SIG_TABLE="${RAPID_IQ_SIGNALS_TABLE:-rapid-cortex-rapid-iq-signals-dev}"
CON_TABLE="${RAPID_IQ_CONTACTS_TABLE:-rapid-cortex-rapid-iq-contacts-dev}"
SRC_TABLE="${RAPID_IQ_SOURCES_TABLE:-rapid-cortex-rapid-iq-sources-dev}"
JUR_TABLE="${RAPID_IQ_JURISDICTIONS_TABLE:-rapid-cortex-rapid-iq-jurisdictions-dev}"
COV_TABLE="${RAPID_IQ_STATE_COVERAGE_TABLE:-rapid-cortex-rapid-iq-state-coverage-dev}"
SALES_LEADS_TABLE="${SALES_LEADS_TABLE:-rapid-cortex-sales-leads-dev}"
AUDIT_TABLE="${AUDIT_TABLE:-rapid-cortex-audit-dev}"

ensure_table "${OPP_TABLE}" \
  --attribute-definitions \
    AttributeName=opportunityId,AttributeType=S \
    AttributeName=vertical,AttributeType=S \
    AttributeName=opportunityScore,AttributeType=N \
    AttributeName=status,AttributeType=S \
    AttributeName=detectedAt,AttributeType=S \
  --key-schema AttributeName=opportunityId,KeyType=HASH \
  --global-secondary-indexes \
    '[{"IndexName":"vertical-score-index","KeySchema":[{"AttributeName":"vertical","KeyType":"HASH"},{"AttributeName":"opportunityScore","KeyType":"RANGE"}],"Projection":{"ProjectionType":"ALL"}},{"IndexName":"status-detected-index","KeySchema":[{"AttributeName":"status","KeyType":"HASH"},{"AttributeName":"detectedAt","KeyType":"RANGE"}],"Projection":{"ProjectionType":"ALL"}}]'

ensure_table "${SIG_TABLE}" \
  --attribute-definitions \
    AttributeName=signalId,AttributeType=S \
    AttributeName=opportunityId,AttributeType=S \
    AttributeName=publishedAt,AttributeType=S \
  --key-schema AttributeName=signalId,KeyType=HASH \
  --global-secondary-indexes \
    '[{"IndexName":"opportunityId-published-index","KeySchema":[{"AttributeName":"opportunityId","KeyType":"HASH"},{"AttributeName":"publishedAt","KeyType":"RANGE"}],"Projection":{"ProjectionType":"ALL"}}]'

ensure_table "${CON_TABLE}" \
  --attribute-definitions \
    AttributeName=contactId,AttributeType=S \
    AttributeName=opportunityId,AttributeType=S \
  --key-schema AttributeName=contactId,KeyType=HASH \
  --global-secondary-indexes \
    '[{"IndexName":"opportunityId-index","KeySchema":[{"AttributeName":"opportunityId","KeyType":"HASH"}],"Projection":{"ProjectionType":"ALL"}}]'

ensure_table "${SRC_TABLE}" \
  --attribute-definitions \
    AttributeName=sourceId,AttributeType=S \
    AttributeName=opportunityId,AttributeType=S \
  --key-schema AttributeName=sourceId,KeyType=HASH \
  --global-secondary-indexes \
    '[{"IndexName":"opportunityId-index","KeySchema":[{"AttributeName":"opportunityId","KeyType":"HASH"}],"Projection":{"ProjectionType":"ALL"}}]'

ensure_table "${JUR_TABLE}" \
  --attribute-definitions \
    AttributeName=jurisdictionId,AttributeType=S \
    AttributeName=stateCode,AttributeType=S \
    AttributeName=tier,AttributeType=N \
    AttributeName=lastScannedAt,AttributeType=S \
  --key-schema AttributeName=jurisdictionId,KeyType=HASH \
  --global-secondary-indexes \
    '[{"IndexName":"state-tier-index","KeySchema":[{"AttributeName":"stateCode","KeyType":"HASH"},{"AttributeName":"tier","KeyType":"RANGE"}],"Projection":{"ProjectionType":"ALL"}},{"IndexName":"tier-lastScanned-index","KeySchema":[{"AttributeName":"tier","KeyType":"HASH"},{"AttributeName":"lastScannedAt","KeyType":"RANGE"}],"Projection":{"ProjectionType":"ALL"}}]'

ensure_table "${COV_TABLE}" \
  --attribute-definitions AttributeName=stateCode,AttributeType=S \
  --key-schema AttributeName=stateCode,KeyType=HASH

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

echo "── Building shared + API ──"
npm run build -w rapid-cortex-shared
npm run build -w rapid-cortex-security || true
# Keep nested api node_modules in sync with package dist
if [[ -d "${ROOT}/apps/api/node_modules/rapid-cortex-shared/dist" ]]; then
  rsync -a --delete "${ROOT}/packages/shared/dist/" "${ROOT}/apps/api/node_modules/rapid-cortex-shared/dist/" || true
fi
if [[ -d "${ROOT}/apps/api/node_modules/rapid-cortex-security/dist" ]]; then
  rsync -a --delete "${ROOT}/packages/security/dist/" "${ROOT}/apps/api/node_modules/rapid-cortex-security/dist/" || true
fi

npm run build -w rapid-cortex-api || true
if [[ ! -f "${ROOT}/apps/api/dist/handlers/rapid-iq/rapidIqHttp.js" ]]; then
  echo "ERROR: rapidIqHttp dist missing after build" >&2
  exit 1
fi
if [[ ! -f "${ROOT}/apps/api/dist/handlers/rapid-iq/collectors/orchestrator.js" ]]; then
  echo "ERROR: orchestrator dist missing after build" >&2
  exit 1
fi
echo "── Using Rapid IQ handler dist ──"

TEMPLATE="${ROOT}/infra/nested/stack-app-sam-rapid-iq.yaml"
sam validate --lint --template-file "${TEMPLATE}"

sam build \
  --template-file "${TEMPLATE}" \
  --build-dir "${SAM_BUILD_DIR}" \
  --no-cached \
  --parallel \
  --build-in-source

STACK_NAME="${RAPID_IQ_API_STACK_NAME:-rapid-cortex-dev-AppSamRapidIqStack}"
HTTP_API_ID="${RAPID_IQ_HTTP_API_ID:-tbr4zvjlk5}"
JWT_AUTHORIZER_ID="${RAPID_IQ_JWT_AUTHORIZER_ID:-}"
ANTHROPIC_ARN="${ANTHROPIC_API_KEY_SECRET_ARN:-}"

PARAM_OVERRIDES=(
  DeploymentStage=dev
  "HttpApiId=${HTTP_API_ID}"
  "RapidIqOpportunitiesTable=${OPP_TABLE}"
  "RapidIqSignalsTable=${SIG_TABLE}"
  "RapidIqContactsTable=${CON_TABLE}"
  "RapidIqSourcesTable=${SRC_TABLE}"
  "RapidIqJurisdictionsTable=${JUR_TABLE}"
  "RapidIqStateCoverageTable=${COV_TABLE}"
  "SalesLeadsTable=${SALES_LEADS_TABLE}"
  "AuditTable=${AUDIT_TABLE}"
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
if [[ -n "${ANTHROPIC_ARN}" ]]; then
  PARAM_OVERRIDES+=("AnthropicApiKeySecretArn=${ANTHROPIC_ARN}")
fi
if [[ -n "${RAPID_IQ_SAM_GOV_API_KEY_SECRET_ARN:-}" ]]; then
  PARAM_OVERRIDES+=("RapidIqSamGovApiKeySecretArn=${RAPID_IQ_SAM_GOV_API_KEY_SECRET_ARN}")
fi
if [[ -n "${RAPID_IQ_HUNTER_API_KEY_SECRET_ARN:-}" ]]; then
  PARAM_OVERRIDES+=("RapidIqHunterApiKeySecretArn=${RAPID_IQ_HUNTER_API_KEY_SECRET_ARN}")
fi
if [[ -n "${RAPID_IQ_APOLLO_API_KEY_SECRET_ARN:-}" ]]; then
  PARAM_OVERRIDES+=("RapidIqApolloApiKeySecretArn=${RAPID_IQ_APOLLO_API_KEY_SECRET_ARN}")
fi
if [[ -n "${RAPID_IQ_TEAMS_WEBHOOK_SECRET_ARN:-}" ]]; then
  PARAM_OVERRIDES+=("RapidIqTeamsWebhookSecretArn=${RAPID_IQ_TEAMS_WEBHOOK_SECRET_ARN}")
fi
if [[ -n "${RAPID_IQ_LEGISCAN_API_KEY_SECRET_ARN:-}" ]]; then
  PARAM_OVERRIDES+=("RapidIqLegiscanApiKeySecretArn=${RAPID_IQ_LEGISCAN_API_KEY_SECRET_ARN}")
fi
if [[ -n "${RAPID_IQ_LEGISCAN_API_KEY:-}" ]]; then
  PARAM_OVERRIDES+=("RapidIqLegiscanApiKey=${RAPID_IQ_LEGISCAN_API_KEY}")
fi
if [[ -n "${RAPID_IQ_RUNSIGNUP_CREDENTIALS_SECRET_ARN:-}" ]]; then
  PARAM_OVERRIDES+=("RapidIqRunsignupCredentialsSecretArn=${RAPID_IQ_RUNSIGNUP_CREDENTIALS_SECRET_ARN}")
fi
if [[ -n "${CONTACT_COMPANIES_TABLE:-}" ]]; then
  PARAM_OVERRIDES+=("ContactCompaniesTable=${CONTACT_COMPANIES_TABLE}")
fi
if [[ -n "${CONTACT_PERSONS_TABLE:-}" ]]; then
  PARAM_OVERRIDES+=("ContactPersonsTable=${CONTACT_PERSONS_TABLE}")
fi

sam deploy \
  --template-file "${SAM_BUILD_DIR}/template.yaml" \
  --stack-name "${STACK_NAME}" \
  --capabilities CAPABILITY_IAM CAPABILITY_NAMED_IAM CAPABILITY_AUTO_EXPAND \
  --resolve-s3 \
  --no-confirm-changeset \
  --no-fail-on-empty-changeset \
  --region "${AWS_REGION}" \
  --parameter-overrides "${PARAM_OVERRIDES[@]}"

echo "Rapid IQ API stack status:"
aws cloudformation describe-stacks --stack-name "${STACK_NAME}" \
  --query 'Stacks[0].StackStatus' --output text

echo "Rapid IQ routes on ${HTTP_API_ID}:"
aws apigatewayv2 get-routes --api-id "${HTTP_API_ID}" \
  --query 'Items[?contains(RouteKey, `rapid-iq`)].[RouteKey,AuthorizationType]' \
  --output table

if [[ "${RAPID_IQ_SEED_OPPORTUNITIES:-0}" == "1" ]]; then
  echo "── Seeding DEMO opportunities (RAPID_IQ_SEED_OPPORTUNITIES=1) ──"
  STAGE=dev \
    RAPID_IQ_OPPORTUNITIES_TABLE="${OPP_TABLE}" \
    RAPID_IQ_SIGNALS_TABLE="${SIG_TABLE}" \
    RAPID_IQ_CONTACTS_TABLE="${CON_TABLE}" \
    RAPID_IQ_SOURCES_TABLE="${SRC_TABLE}" \
    npx tsx scripts/seed-rapid-iq-dev.ts
elif [[ "${RAPID_IQ_SKIP_SEED:-0}" != "1" ]]; then
  echo "── Seeding jurisdictions registry only (no demo opportunities) ──"
  STAGE=dev \
    RAPID_IQ_JURISDICTIONS_TABLE="${JUR_TABLE}" \
    RAPID_IQ_STATE_COVERAGE_TABLE="${COV_TABLE}" \
    npx tsx scripts/seed-rapid-iq-jurisdictions.ts
  echo "── Skipping opportunity seed (set RAPID_IQ_SEED_OPPORTUNITIES=1 to force demo data) ──"
else
  echo "── Skipping all Rapid IQ seeds (RAPID_IQ_SKIP_SEED=1) ──"
fi

echo "✅ Rapid IQ API deploy complete"
