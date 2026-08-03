#!/usr/bin/env bash
# Surgical Careers + Hiring ATS API for rapid-cortex-dev (AppSam3 HttpApi).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

# shellcheck source=scripts/env-api-dev.sh
source "${ROOT}/scripts/env-api-dev.sh"
export AWS_PROFILE="${AWS_PROFILE:-rapid-cortex}"
export AWS_REGION="${AWS_REGION:-us-east-1}"
export AWS_DEFAULT_REGION="${AWS_DEFAULT_REGION:-$AWS_REGION}"
export NODE_OPTIONS="${NODE_OPTIONS:---max-old-space-size=8192}"

ACCOUNT_ID="$(aws sts get-caller-identity --query Account --output text)"
JOB_APPLICATIONS_TABLE="${JOB_APPLICATIONS_TABLE:-rapid-cortex-job-applications-dev}"
RESUMES_BUCKET="${RESUMES_BUCKET:-rapid-cortex-resumes-dev-${ACCOUNT_ID}}"

# Ensure table exists (DataLayer may not have been updated yet).
if ! aws dynamodb describe-table --table-name "${JOB_APPLICATIONS_TABLE}" >/dev/null 2>&1; then
  echo "── Creating ${JOB_APPLICATIONS_TABLE} ──"
  aws dynamodb create-table \
    --table-name "${JOB_APPLICATIONS_TABLE}" \
    --billing-mode PAY_PER_REQUEST \
    --attribute-definitions \
      AttributeName=applicationId,AttributeType=S \
      AttributeName=status,AttributeType=S \
      AttributeName=position,AttributeType=S \
      AttributeName=createdAt,AttributeType=S \
    --key-schema AttributeName=applicationId,KeyType=HASH \
    --global-secondary-indexes \
      '[{"IndexName":"StatusCreatedAtIndex","KeySchema":[{"AttributeName":"status","KeyType":"HASH"},{"AttributeName":"createdAt","KeyType":"RANGE"}],"Projection":{"ProjectionType":"ALL"}},{"IndexName":"PositionCreatedAtIndex","KeySchema":[{"AttributeName":"position","KeyType":"HASH"},{"AttributeName":"createdAt","KeyType":"RANGE"}],"Projection":{"ProjectionType":"ALL"}}]'
  aws dynamodb wait table-exists --table-name "${JOB_APPLICATIONS_TABLE}"
fi

if ! aws s3api head-bucket --bucket "${RESUMES_BUCKET}" 2>/dev/null; then
  echo "── Creating s3://${RESUMES_BUCKET} ──"
  aws s3api create-bucket --bucket "${RESUMES_BUCKET}" --region "${AWS_REGION}"
  aws s3api put-public-access-block --bucket "${RESUMES_BUCKET}" \
    --public-access-block-configuration BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true
  aws s3api put-bucket-encryption --bucket "${RESUMES_BUCKET}" \
    --server-side-encryption-configuration '{"Rules":[{"ApplyServerSideEncryptionByDefault":{"SSEAlgorithm":"AES256"}}]}'
  aws s3api put-bucket-cors --bucket "${RESUMES_BUCKET}" --cors-configuration '{
    "CORSRules":[{
      "AllowedHeaders":["*"],
      "AllowedMethods":["GET","PUT","HEAD"],
      "AllowedOrigins":["https://www.rapidcortex.us","https://rapidcortex.us","https://app.rapidcortex.us","http://localhost:3000","http://localhost:3001"],
      "ExposeHeaders":["ETag","x-amz-request-id","x-amz-id-2"],
      "MaxAgeSeconds":3600
    }]
  }'
fi

# Ensure CORS is set even if the bucket already existed without rules.
aws s3api put-bucket-cors --bucket "${RESUMES_BUCKET}" --cors-configuration '{
  "CORSRules":[{
    "AllowedHeaders":["*"],
    "AllowedMethods":["GET","PUT","HEAD"],
    "AllowedOrigins":["https://www.rapidcortex.us","https://rapidcortex.us","https://app.rapidcortex.us","http://localhost:3000","http://localhost:3001"],
    "ExposeHeaders":["ETag","x-amz-request-id","x-amz-id-2"],
    "MaxAgeSeconds":3600
  }]
}' >/dev/null

SAM_BUILD_DIR="/Volumes/Mac Mini/.sam-lean-build/hiring-$(date +%Y%m%d-%H%M%S)"
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

echo "── Building shared + api ──"
npm run build -w rapid-cortex-shared
npm run build -w rapid-cortex-security || true
npm run build -w rapid-cortex-api

for f in \
  apps/api/dist/handlers/careers/presignedUpload.js \
  apps/api/dist/handlers/careers/apply.js \
  apps/api/dist/handlers/rc-admin/rcAdminApplicationsHttp.js
do
  if [[ ! -f "${ROOT}/${f}" ]]; then
    echo "ERROR: missing ${f}" >&2
    exit 1
  fi
done

TEMPLATE="${ROOT}/infra/nested/stack-app-sam-3-hiring.yaml"
sam validate --lint --template-file "${TEMPLATE}"

sam build \
  --template-file "${TEMPLATE}" \
  --build-dir "${SAM_BUILD_DIR}" \
  --no-cached \
  --parallel \
  --build-in-source

STACK_NAME="${HIRING_API_STACK_NAME:-rapid-cortex-dev-AppSamHiringStack}"
HTTP_API_ID="${HIRING_HTTP_API_ID:-tbr4zvjlk5}"
JWT_AUTHORIZER_ID="${HIRING_JWT_AUTHORIZER_ID:-k8rjdh}"

sam deploy \
  --template-file "${SAM_BUILD_DIR}/template.yaml" \
  --stack-name "${STACK_NAME}" \
  --capabilities CAPABILITY_IAM CAPABILITY_NAMED_IAM CAPABILITY_AUTO_EXPAND \
  --resolve-s3 \
  --no-confirm-changeset \
  --no-fail-on-empty-changeset \
  --region "${AWS_REGION}" \
  --parameter-overrides \
    DeploymentStage=dev \
    "HttpApiId=${HTTP_API_ID}" \
    "HttpApiJwtAuthorizerId=${JWT_AUTHORIZER_ID}" \
    "JobApplicationsTable=${JOB_APPLICATIONS_TABLE}" \
    "ResumesBucket=${RESUMES_BUCKET}" \
    AuditTable=rapid-cortex-audit-dev \
    AgenciesTable=rapid-cortex-agencies-dev \
    IncidentsTable=rapid-cortex-incidents-dev \
    TranscriptsTable=rapid-cortex-transcripts-dev \
    AnalysesTable=rapid-cortex-analyses-dev \
    InvitesTable=rapid-cortex-invites-dev \
    AssetsBucket=rapid-cortex-assets-dev-158961537080 \
    ImportedCognitoUserPoolId=us-east-1_0z6tA6WBs \
    ImportedCognitoWebClientId=7moi6sgc2uf4o31omgvo77h3v5 \
    ManagedPolicyNamePrefix=rapid-cortex-dev \
    CareersFromEmail=careers@rapidcortex.us \
    CareersNotifyEmail=jeff@rapidcortex.us \
    ReviewerName="Jeffrey Coleman" \
    SesMock=false

echo "Hiring API stack status:"
aws cloudformation describe-stacks --stack-name "${STACK_NAME}" \
  --query 'Stacks[0].StackStatus' --output text

echo "Careers / applications routes on ${HTTP_API_ID}:"
aws apigatewayv2 get-routes --api-id "${HTTP_API_ID}" \
  --query 'Items[?contains(RouteKey, `careers`) || contains(RouteKey, `applications`)].[RouteKey,AuthorizationType]' \
  --output table
