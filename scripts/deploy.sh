#!/usr/bin/env bash
set -euo pipefail
# One-command deploy: build workspaces and deploy SAM backend with optional domain parameters.
# Usage: ./scripts/deploy.sh [dev|staging|prod|pilot] [--changeset-only|--no-execute-changeset]
# Requires: AWS CLI, SAM CLI, npm, credentials for the target account.
# Nested stacks require CAPABILITY_AUTO_EXPAND (applied below).
#
# Preflight:
# - EXPECTED_AWS_ACCOUNT_ID optional; mismatch prints a loud WARN before deploy proceeds.
# - Production HttpApi CORS via HTTP_API_CORS_ORIGINS must be HTTPS origins only (see validation below).
# - Template size gate: scripts/infra-template-size-check.sh after sam build.
#
# Optional env:
# - ROOT_DOMAIN (default: rapidcortex.us)
# - API_SUBDOMAIN_PREFIX (default: api)
# - API_DOMAIN_CERT_ARN (imported ACM ARN; same region as stack)
# - ROUTE53_HOSTED_ZONE_ID (optional; if set without API_DOMAIN_CERT_ARN, stack requests ACM cert via DNS)
# - APP_CNAME_TARGET
# - ADMIN_CNAME_TARGET
# - WWW_CNAME_TARGET
# - HTTP_API_CORS_ORIGINS (comma-separated; forwarded to SAM HttpApiCorsAllowedOrigins)
# - SKIP_CORS_CHECK=1 to skip the non-dev CORS reminder below
# - APP_NAME (default: rapid-cortex) → Sam parameter AppName; also default stack name prefix
# - STACK_NAME (optional) → CloudFormation stack name; default ${APP_NAME}-${STAGE}
# - DDB_TABLE_PREFIX, DDB_BILLING_MODE, DDB_ENABLE_PITR (true|false|auto)
# - COGNITO_USER_POOL_NAME, COGNITO_APP_CLIENT_NAME, COGNITO_DOMAIN_PREFIX,
#   COGNITO_CALLBACK_URLS, COGNITO_LOGOUT_URLS, COGNITO_GENERATE_SECRET
# - SNS_EMAIL_SUBSCRIPTION, SNS_SMS_TEST_NUMBER
# - SES_IDENTITY_TYPE (email|domain), SES_IDENTITY_VALUE, SES_CONFIGURATION_SET_NAME
# - ENABLE_API_WAF (true|false) → EnableApiWaf; optional WAF_RATE_LIMIT_5M, TRANSCRIPT_RETENTION_POLICY_DAYS
# - ENABLE_CLOUD_TRAIL (true|false) → EnableCloudTrail (template default true). Set false in dev if CloudTrail S3
#   bucket name conflicts with an existing retained bucket from a prior deploy.
# - INCLUDE_DATA_LAYER_NESTED_STACK=false for legacy dev stacks whose DynamoDB/S3 already live on the root stack
#   (same names as nested stack-data-layer). Requires FLAT_DATA_LAYER_BILLING_PAYMENT_INSTRUCTIONS_SECRET_ARN and
#   FLAT_DATA_LAYER_BILLING_SES_CREDENTIALS_SECRET_ARN (full Secrets Manager ARNs). Default: nested data layer enabled.
# - INCLUDE_APP_SAM_ALARMS_NESTED_STACK=false (dev only): skip nested stack-app-alarms.yaml so AppSamStack can refresh
#   outputs (e.g. QaHttpFunctionName) without GetAtt failures from a stale paused nested stack. Non-dev deployments
#   must keep alarms enabled (Rules in template.yaml). Omit or set true after AppSamStack is healthy; default true.
# - SAM_BUILD_USE_CACHE=0 force full rebuild (--no-cached). Default: 1 (cached incremental).
# - SAM_PARALLEL=0 disables sam build --parallel (default 1).
# - SAM_BUILD_DIR explicit sam build output directory (mkdir -p before build). If unset, defaults to
#   repo-root .rapid-cortex-sam-build (not $TMPDIR) so errno 28 on /var/folders is avoided when the boot volume is full.
# - BUILD_WEB_BEFORE_SAM=1 run `npm run build -w rapid-cortex-web` before sam build (off by default: SAM bundles
#   Lambda code from apps/api only; Next.js belongs to ECS/CodeBuild/S3 pipelines, not this script)
# - SKIP_CFN_DIAG_ON_DEPLOY_FAIL=1 skip AWS CLI stack-event diagnostics after a failed sam deploy (default: run them).
# IAM role/policy names for the deploy principal are not stack parameters.
# Use scripts/deploy-iam.sh (or deploy-from-env.sh with IAM_ROLE_NAME + IAM_POLICY_NAME) before SAM deploy.

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

STAGE=""
CHANGESET_ONLY=0
for arg in "$@"; do
  case "$arg" in
    dev | staging | prod | pilot) STAGE="$arg" ;;
    --changeset-only | --no-execute-changeset) CHANGESET_ONLY=1 ;;
    *)
      echo "Unknown argument: $arg" >&2
      echo "Usage: $0 [dev|staging|prod|pilot] [--changeset-only|--no-execute-changeset]" >&2
      exit 1
      ;;
  esac
done

if [[ -z "$STAGE" ]]; then
  echo "Usage: $0 [dev|staging|prod|pilot] [--changeset-only|--no-execute-changeset]" >&2
  exit 1
fi

if [[ "$STAGE" != "dev" && -z "${HTTP_API_CORS_ORIGINS:-}" && "${SKIP_CORS_CHECK:-}" != "1" ]]; then
  echo "WARN: HTTP_API_CORS_ORIGINS is empty for ${STAGE}. Set comma-separated https origins (no spaces), e.g.:" >&2
  echo "  HTTP_API_CORS_ORIGINS=https://www.rapidcortex.us,https://www.example.org $0 ${STAGE}" >&2
  echo "Or export SKIP_CORS_CHECK=1 to deploy anyway." >&2
  exit 1
fi

if [[ "$STAGE" == "prod" && -n "${HTTP_API_CORS_ORIGINS:-}" ]]; then
  if [[ "$(echo "${HTTP_API_CORS_ORIGINS}" | tr '[:upper:]' '[:lower:]')" == *\** ]]; then
    echo "ERROR: Production HTTP_API_CORS_ORIGINS must not use wildcard '*'. Use explicit https origins." >&2
    exit 1
  fi
  if [[ "${HTTP_API_CORS_ORIGINS}" == *localhost* || "${HTTP_API_CORS_ORIGINS}" == *127.0.0.1* ]]; then
    echo "ERROR: Production HTTP_API_CORS_ORIGINS must not include localhost or 127.0.0.1." >&2
    exit 1
  fi
  ORIG_IFS="$IFS"
  IFS=,
  for origin in ${HTTP_API_CORS_ORIGINS}; do
    o="$(echo "${origin}" | awk '{$1=$1};1')"
    [[ -z "$o" ]] && continue
    if [[ "$o" == http:* ]]; then
      echo "ERROR: Production HTTP_API_CORS_ORIGINS must use https:// only. Rejected: ${o}" >&2
      IFS="$ORIG_IFS"
      exit 1
    fi
    if [[ "$o" != https://* ]]; then
      echo "ERROR: Production HTTP_API_CORS_ORIGINS must be HTTPS URLs (scheme required). Rejected: ${o}" >&2
      IFS="$ORIG_IFS"
      exit 1
    fi
  done
  IFS="$ORIG_IFS"
fi

if [[ -n "${EXPECTED_AWS_ACCOUNT_ID:-}" ]] && command -v aws >/dev/null 2>&1; then
  cur_acct=""
  cur_acct="$(aws sts get-caller-identity --query Account --output text 2>/dev/null || echo "")"
  if [[ -n "${cur_acct:-}" && "${cur_acct}" != "${EXPECTED_AWS_ACCOUNT_ID}" ]]; then
    echo "========================================================" >&2
    echo "WARN: AWS CLI account (${cur_acct}) != EXPECTED_AWS_ACCOUNT_ID (${EXPECTED_AWS_ACCOUNT_ID})." >&2
    echo "Unset EXPECTED_AWS_ACCOUNT_ID or switch credentials before production deploy." >&2
    echo "========================================================" >&2
    sleep 2
  fi
fi

if [[ "${INCLUDE_DATA_LAYER_NESTED_STACK:-true}" == "false" ]]; then
  if [[ -z "${FLAT_DATA_LAYER_BILLING_PAYMENT_INSTRUCTIONS_SECRET_ARN:-}" || -z "${FLAT_DATA_LAYER_BILLING_SES_CREDENTIALS_SECRET_ARN:-}" ]]; then
    echo "ERROR: INCLUDE_DATA_LAYER_NESTED_STACK=false requires both billing secret ARNs:" >&2
    echo "  export FLAT_DATA_LAYER_BILLING_PAYMENT_INSTRUCTIONS_SECRET_ARN=\"\$(aws secretsmanager describe-secret --secret-id rapid-cortex/billing/payment-instructions --query ARN --output text)\"" >&2
    echo "  export FLAT_DATA_LAYER_BILLING_SES_CREDENTIALS_SECRET_ARN=\"\$(aws secretsmanager describe-secret --secret-id rapid-cortex/billing/ses-credentials --query ARN --output text)\"" >&2
    exit 1
  fi
fi

if [[ "${INCLUDE_APP_SAM_ALARMS_NESTED_STACK:-true}" == "false" && "$STAGE" != "dev" ]]; then
  echo "ERROR: INCLUDE_APP_SAM_ALARMS_NESTED_STACK=false is dev-only (template Rules require alarms for staging/pilot/prod)." >&2
  exit 1
fi

echo "SAM validate (nested stacks use --lint; root is nested-stack parent only)..."
# Root template has no Transform; `sam validate --lint` on it still expands children and can emit
# false-positive W8001 from inlining. Nested templates are the authoritative SAM lint surface.
sam validate --template-file "${ROOT}/infra/template.yaml"
sam validate --lint --template-file "${ROOT}/infra/nested/stack-data-layer.yaml"
sam validate --lint --template-file "${ROOT}/infra/nested/stack-app-sam.yaml"
sam validate --lint --template-file "${ROOT}/infra/nested/stack-app-sam-2.yaml"
sam validate --lint --template-file "${ROOT}/infra/nested/stack-app-alarms-2.yaml"

ROOT_DOMAIN="${ROOT_DOMAIN:-rapidcortex.us}"
API_SUBDOMAIN_PREFIX="${API_SUBDOMAIN_PREFIX:-api}"
API_DOMAIN_CERT_ARN="${API_DOMAIN_CERT_ARN:-}"
ROUTE53_HOSTED_ZONE_ID="${ROUTE53_HOSTED_ZONE_ID:-}"
APP_CNAME_TARGET="${APP_CNAME_TARGET:-}"
ADMIN_CNAME_TARGET="${ADMIN_CNAME_TARGET:-}"
WWW_CNAME_TARGET="${WWW_CNAME_TARGET:-}"
HTTP_API_CORS_ORIGINS="${HTTP_API_CORS_ORIGINS:-}"
APP_NAME="${APP_NAME:-rapid-cortex}"
STACK_NAME="${STACK_NAME:-${APP_NAME}-${STAGE}}"

echo "═══════════════════════════════════════════════════════"
echo " Rapid Cortex SAM backend deployment"
echo "═══════════════════════════════════════════════════════"
echo " Stage:                ${STAGE}"
echo " Stack:                ${STACK_NAME}"
echo " BUILD_WEB_BEFORE_SAM: ${BUILD_WEB_BEFORE_SAM:-0}"
echo " SAM_BUILD_USE_CACHE:  ${SAM_BUILD_USE_CACHE:-1}"
echo " SAM_PARALLEL:          ${SAM_PARALLEL:-1}"
echo " SAM_BUILD_DIR:         ${SAM_BUILD_DIR:-${ROOT}/.rapid-cortex-sam-build}"
echo "═══════════════════════════════════════════════════════"

# Monorepo packages are not on npm. In-repo, `apps/api` uses `file:../../packages/*` (see `apps/api/package.json`).
# For SAM we temporarily rewrite to `file:vendor-packs/*.tgz`, pack fresh tarballs, reinstall, and
# rsync `dist/` from `packages/*` so TypeScript and the Lambda bundle see the same artifacts.
# Do not commit apps/api with vendor-packs paths: npm workspaces + tarball REPLACE can crash npm 10 arborist.
npm install
npm run build -w rapid-cortex-shared
npm run build -w rapid-cortex-protocols
npm run build -w rapid-cortex-integrations
npm run build -w rapid-cortex-security
VENDOR_DIR="apps/api/vendor-packs"
mkdir -p "$VENDOR_DIR"
# Prints tarball filename only (last line of npm pack is the .tgz name).
pack_tgz() {
  local pkg_dir="$ROOT/$1"
  local out
  out="$(cd "$pkg_dir" && npm pack --pack-destination "$ROOT/$VENDOR_DIR" 2>/dev/null | tail -1)"
  echo "$(basename "$out")"
}
T_SHARED="$(pack_tgz packages/shared)"
T_INT="$(pack_tgz packages/integrations)"
T_SEC="$(pack_tgz packages/security)"
export T_SHARED T_INT T_SEC
for _tgz_name in "$T_SHARED" "$T_INT" "$T_SEC"; do
  if [[ -z "${_tgz_name}" || ! -f "${ROOT}/${VENDOR_DIR}/${_tgz_name}" ]]; then
    echo "ERROR: npm pack failed for a workspace package (expected tgz under ${VENDOR_DIR}/)." >&2
    exit 1
  fi
done
REVERT_API_PKG=0
if [[ -f "${ROOT}/apps/api/package.json" ]]; then
  cp "${ROOT}/apps/api/package.json" "${ROOT}/apps/api/package.json.pre-sam"
  REVERT_API_PKG=1
  if ! command -v jq &>/dev/null; then
    echo "deploy.sh requires 'jq' to rewrite apps/api/package.json for SAM (brew install jq)." >&2
    exit 1
  fi
  API_PKG_TMP="$(mktemp "${ROOT}/apps/api/package.json.tmp.XXXXXX")"
  if ! jq \
    --arg s "file:vendor-packs/${T_SHARED}" \
    --arg i "file:vendor-packs/${T_INT}" \
    --arg e "file:vendor-packs/${T_SEC}" \
    '.dependencies["rapid-cortex-shared"]=$s | .dependencies["rapid-cortex-integrations"]=$i | .dependencies["rapid-cortex-security"]=$e' \
    "${ROOT}/apps/api/package.json" > "${API_PKG_TMP}"; then
    rm -f "${API_PKG_TMP}"
    echo "ERROR: jq failed to rewrite apps/api/package.json for SAM vendor-packs." >&2
    exit 1
  fi
  if [[ ! -s "${API_PKG_TMP}" ]]; then
    rm -f "${API_PKG_TMP}"
    echo "ERROR: jq produced an empty rewrite for apps/api/package.json." >&2
    exit 1
  fi
  mv "${API_PKG_TMP}" "${ROOT}/apps/api/package.json"
fi
# Same-version file: tgz can leave a stale copy in node_modules; remove before reinstall.
# chmod first: some trees (e.g. nested dist/) can be non-writable on APFS/external volumes and break rm -rf.
for _pkg_dir in apps/api/node_modules/rapid-cortex-shared apps/api/node_modules/rapid-cortex-integrations apps/api/node_modules/rapid-cortex-security; do
  if [[ -e "$_pkg_dir" ]]; then
    chmod -R u+w "$_pkg_dir" 2>/dev/null || true
    rm -rf "$_pkg_dir"
  fi
done
# Root npm install after rewriting to vendor tarballs can crash npm 10/11 arborist (workspace REPLACE / null target).
# Install from apps/api with --no-workspaces so npm does not merge the monorepo workspace graph.
cd apps/api && npm install --no-workspaces && cd "$ROOT"
# npm may re-use a bad extracted tarball; sync built dist/ from workspaces so API tsc always matches
# packages/* (SAM still packages the tgzs produced above, which include up-to-date dist/ from npm pack).
if [[ -d apps/api/node_modules/rapid-cortex-shared ]]; then
  rsync -a --delete packages/shared/dist/ apps/api/node_modules/rapid-cortex-shared/dist/
fi
if [[ -d apps/api/node_modules/rapid-cortex-integrations ]]; then
  rsync -a --delete packages/integrations/dist/ apps/api/node_modules/rapid-cortex-integrations/dist/
fi
if [[ -d apps/api/node_modules/rapid-cortex-security ]]; then
  rsync -a --delete packages/security/dist/ apps/api/node_modules/rapid-cortex-security/dist/
fi
npm run build -w rapid-cortex-api
if [[ "${BUILD_WEB_BEFORE_SAM:-0}" == "1" ]]; then
  echo "BUILD_WEB_BEFORE_SAM=1: building rapid-cortex-web (SAM does not consume this artifact)." >&2
  npm run build -w rapid-cortex-web
fi
cd "$ROOT/infra/cognito-post-confirmation" && npm install --no-workspaces && cd "$ROOT"
# SAM CLI may rmtree SAM_BUILD_DIR — default lives under repo root (.rapid-cortex-sam-build, gitignored) so builds do
# not fill macOS /var/folders/$TMPDIR (often tiny when the boot volume is nearly full).
if [[ -n "${SAM_BUILD_DIR:-}" ]]; then
  mkdir -p "${SAM_BUILD_DIR}"
else
  SAM_BUILD_DIR="${ROOT}/.rapid-cortex-sam-build"
  mkdir -p "${SAM_BUILD_DIR}"
fi
echo "SAM build directory: ${SAM_BUILD_DIR}"

# Warn when the filesystem backing SAM_BUILD_DIR is low on space — sam build expands many copies here and can hit
# errno 28 on /private/var/folders/... despite the main repo living on another drive.
SAM_BUILD_MIN_FREE_KIB=$((1536 * 1024))
if [[ -d "${SAM_BUILD_DIR}" ]] && avail_k="$(df -Pk "${SAM_BUILD_DIR}" 2>/dev/null | tail -1 | awk '{ print int($4) }')" && [[ -n "${avail_k}" ]] && [[ "${avail_k}" -lt "${SAM_BUILD_MIN_FREE_KIB}" ]]; then
  echo "========================================================" >&2
  echo "WARN: SAM build filesystem has ~$((avail_k / 1048576)) GiB free (under ~$((SAM_BUILD_MIN_FREE_KIB / 1048576)) GiB heuristic)." >&2
  echo "      sam build may fail with 'No space left on device'. Free space or set SAM_BUILD_DIR on a roomy volume." >&2
  echo "========================================================" >&2
fi
sam_build_failed=0
SAM_BUILD_CLI=(sam build --template-file infra/template.yaml --build-dir "${SAM_BUILD_DIR}")
if [[ "${SAM_BUILD_USE_CACHE:-1}" == "1" ]]; then
  SAM_BUILD_CLI+=(--cached)
else
  SAM_BUILD_CLI+=(--no-cached)
fi
if [[ "${SAM_PARALLEL:-1}" == "1" ]]; then
  SAM_BUILD_CLI+=(--parallel)
fi
"${SAM_BUILD_CLI[@]}" || sam_build_failed=$?
if [[ "$REVERT_API_PKG" -eq 1 ]]; then
  mv "${ROOT}/apps/api/package.json.pre-sam" "${ROOT}/apps/api/package.json"
fi
if [[ "$sam_build_failed" -ne 0 ]]; then
  exit "$sam_build_failed"
fi

echo "Template size gate (SAM build dir: ${SAM_BUILD_DIR})..."
RC_SAM_BUILD_DIR="${SAM_BUILD_DIR}" bash "${ROOT}/scripts/infra-template-size-check.sh"

PARAMS="DeploymentStage=${STAGE} RootDomainName=${ROOT_DOMAIN} ApiSubdomainPrefix=${API_SUBDOMAIN_PREFIX} AppName=${APP_NAME}"
if [[ -n "${DDB_TABLE_PREFIX:-}" ]]; then
  PARAMS="${PARAMS} DynamoTableNamePrefix=${DDB_TABLE_PREFIX}"
fi
if [[ -n "${DDB_BILLING_MODE:-}" ]]; then
  PARAMS="${PARAMS} DynamoBillingMode=${DDB_BILLING_MODE}"
fi
if [[ -n "${DDB_ENABLE_PITR:-}" ]]; then
  PARAMS="${PARAMS} DynamoPointInTimeRecovery=${DDB_ENABLE_PITR}"
fi
if [[ -n "${COGNITO_USER_POOL_NAME:-}" ]]; then
  PARAMS="${PARAMS} CognitoUserPoolName=${COGNITO_USER_POOL_NAME}"
fi
if [[ -n "${COGNITO_APP_CLIENT_NAME:-}" ]]; then
  PARAMS="${PARAMS} CognitoAppClientName=${COGNITO_APP_CLIENT_NAME}"
fi
if [[ -n "${COGNITO_DOMAIN_PREFIX:-}" ]]; then
  PARAMS="${PARAMS} CognitoDomainPrefix=${COGNITO_DOMAIN_PREFIX}"
fi
if [[ -n "${COGNITO_CALLBACK_URLS:-}" ]]; then
  PARAMS="${PARAMS} CognitoCallbackUrls=${COGNITO_CALLBACK_URLS}"
fi
if [[ -n "${COGNITO_LOGOUT_URLS:-}" ]]; then
  PARAMS="${PARAMS} CognitoLogoutUrls=${COGNITO_LOGOUT_URLS}"
fi
if [[ -n "${COGNITO_GENERATE_SECRET:-}" ]]; then
  PARAMS="${PARAMS} CognitoGenerateSecret=${COGNITO_GENERATE_SECRET}"
fi
if [[ -n "${SNS_EMAIL_SUBSCRIPTION:-}" ]]; then
  PARAMS="${PARAMS} SnsEmailSubscription=${SNS_EMAIL_SUBSCRIPTION}"
fi
if [[ -n "${SNS_SMS_TEST_NUMBER:-}" ]]; then
  PARAMS="${PARAMS} SnsSmsSubscription=${SNS_SMS_TEST_NUMBER}"
fi
if [[ -n "${SES_IDENTITY_TYPE:-}" ]]; then
  PARAMS="${PARAMS} SesIdentityType=${SES_IDENTITY_TYPE}"
fi
if [[ -n "${SES_IDENTITY_VALUE:-}" ]]; then
  PARAMS="${PARAMS} SesIdentityValue=${SES_IDENTITY_VALUE}"
fi
if [[ -n "${SES_CONFIGURATION_SET_NAME:-}" ]]; then
  PARAMS="${PARAMS} SesConfigurationSetName=${SES_CONFIGURATION_SET_NAME}"
fi
if [[ -n "$API_DOMAIN_CERT_ARN" ]]; then
  PARAMS="${PARAMS} ApiDomainCertificateArn=${API_DOMAIN_CERT_ARN}"
fi
if [[ -n "$ROUTE53_HOSTED_ZONE_ID" ]]; then
  PARAMS="${PARAMS} Route53HostedZoneId=${ROUTE53_HOSTED_ZONE_ID}"
fi
if [[ -n "$APP_CNAME_TARGET" ]]; then
  PARAMS="${PARAMS} AppCnameTarget=${APP_CNAME_TARGET}"
fi
if [[ -n "$ADMIN_CNAME_TARGET" ]]; then
  PARAMS="${PARAMS} AdminCnameTarget=${ADMIN_CNAME_TARGET}"
fi
if [[ -n "$WWW_CNAME_TARGET" ]]; then
  PARAMS="${PARAMS} WwwCnameTarget=${WWW_CNAME_TARGET}"
fi
if [[ -n "$HTTP_API_CORS_ORIGINS" ]]; then
  PARAMS="${PARAMS} HttpApiCorsAllowedOrigins=${HTTP_API_CORS_ORIGINS}"
fi
if [[ -n "${ENABLE_API_WAF:-}" ]]; then
  PARAMS="${PARAMS} EnableApiWaf=${ENABLE_API_WAF}"
fi
if [[ -n "${ENABLE_LIVE_VIDEO_RESOURCES:-}" ]]; then
  PARAMS="${PARAMS} EnableLiveVideoResources=${ENABLE_LIVE_VIDEO_RESOURCES}"
fi
if [[ -n "${WAF_RATE_LIMIT_5M:-}" ]]; then
  PARAMS="${PARAMS} WafRateLimitPer5Min=${WAF_RATE_LIMIT_5M}"
fi
if [[ -n "${TRANSCRIPT_RETENTION_POLICY_DAYS:-}" ]]; then
  PARAMS="${PARAMS} TranscriptRetentionPolicyDays=${TRANSCRIPT_RETENTION_POLICY_DAYS}"
fi
# CAD write-back: blocked in prod until pilot go/no-go + signed agency addendum (see cursor-prompt-cad-writeback-pilot.md).
if [[ "$STAGE" == "prod" && "${CAD_WRITEBACK_ENABLED:-}" == "true" ]]; then
  echo "ERROR: CAD_WRITEBACK_ENABLED=true is not allowed for prod deploys until pilot validation and a signed CAD writeback addendum." >&2
  exit 1
fi
if [[ -n "${CAD_WRITEBACK_ENABLED:-}" ]]; then
  PARAMS="${PARAMS} CadWritebackEnabled=${CAD_WRITEBACK_ENABLED}"
fi
if [[ -n "${CAD_WRITEBACK_REQUIRES_APPROVAL:-}" ]]; then
  PARAMS="${PARAMS} CadWritebackRequiresApproval=${CAD_WRITEBACK_REQUIRES_APPROVAL}"
fi
if [[ -n "${ENABLE_CLOUD_TRAIL:-}" ]]; then
  PARAMS="${PARAMS} EnableCloudTrail=${ENABLE_CLOUD_TRAIL}"
fi
if [[ "${INCLUDE_DATA_LAYER_NESTED_STACK:-true}" == "false" ]]; then
  PARAMS="${PARAMS} IncludeDataLayerNestedStack=false"
  PARAMS="${PARAMS} FlatDataLayerBillingPaymentInstructionsSecretArn=${FLAT_DATA_LAYER_BILLING_PAYMENT_INSTRUCTIONS_SECRET_ARN}"
  PARAMS="${PARAMS} FlatDataLayerBillingSesCredentialsSecretArn=${FLAT_DATA_LAYER_BILLING_SES_CREDENTIALS_SECRET_ARN}"
else
  PARAMS="${PARAMS} IncludeDataLayerNestedStack=true"
fi
if [[ "${INCLUDE_APP_SAM_ALARMS_NESTED_STACK:-true}" == "false" ]]; then
  PARAMS="${PARAMS} IncludeAppSamAlarmsNestedStack=false"
fi

DEPLOY_CHANGESET_SUFFIX=()
if [[ "${CHANGESET_ONLY}" -eq 1 ]]; then
  DEPLOY_CHANGESET_SUFFIX+=(--no-execute-changeset)
  echo "Change set mode: creating change set without execution (--no-execute-changeset). Review then deploy again without flag to execute." >&2
fi

# set -u: always expand suffix array safely (empty suffix is valid).
set +u
DEPLOY_SUFFIX=( "${DEPLOY_CHANGESET_SUFFIX[@]}" )
set -u

rapid_cortex_print_deploy_failure_reason() {
  echo "" >&2
  echo "════════════════════════════════════════════════════════════════" >&2
  echo " SAM deploy failed — CloudFormation diagnostics" >&2
  echo " Stack: ${STACK_NAME}" >&2
  echo "════════════════════════════════════════════════════════════════" >&2
  if [[ "${SKIP_CFN_DIAG_ON_DEPLOY_FAIL:-0}" == "1" ]]; then
    echo "SKIP_CFN_DIAG_ON_DEPLOY_FAIL=1 → skipping aws describe-* (sam output above may still explain the failure)." >&2
    return 0
  fi
  if ! command -v aws >/dev/null 2>&1; then
    echo "WARN: aws CLI not on PATH — cannot fetch stack failure details automatically." >&2
    return 0
  fi
  local status="" reason=""
  status="$(aws cloudformation describe-stacks --stack-name "${STACK_NAME}" --query 'Stacks[0].StackStatus' --output text 2>/dev/null || echo "")"
  reason="$(aws cloudformation describe-stacks --stack-name "${STACK_NAME}" --query 'Stacks[0].StackStatusReason' --output text 2>/dev/null || echo "")"
  if [[ -z "${status}" || "${status}" == "None" ]]; then
    echo "WARN: Could not describe stack '${STACK_NAME}' (wrong account/region/name or IAM)." >&2
    return 0
  fi
  echo " Root StackStatus: ${status}" >&2
  if [[ -n "${reason:-}" && "${reason}" != "None" ]]; then
    echo " Root StackStatusReason:" >&2
    echo "${reason}" >&2
  fi
  echo "" >&2
  echo "--- Resources in *_FAILED states (root stack) ---" >&2
  aws cloudformation describe-stack-resources --stack-name "${STACK_NAME}" \
    --query "StackResources[?contains(ResourceStatus, 'FAILED')].[LogicalResourceId,ResourceStatus,ResourceType,PhysicalResourceId]" \
    --output table 2>&2 || echo "(describe-stack-resources failed)" >&2
  echo "" >&2
  echo "--- Recent resource FAILURE events on root stack (filtered from last 80 events) ---" >&2
  aws cloudformation describe-stack-events --stack-name "${STACK_NAME}" --max-items 80 \
    --query "StackEvents[?contains(ResourceStatus, 'FAILED')].[Timestamp,LogicalResourceId,ResourceStatus,ResourceStatusReason]" \
    --output table 2>&2 || echo "(describe-stack-events on root failed)" >&2

  local failed_nested=""
  failed_nested="$(aws cloudformation describe-stack-resources --stack-name "${STACK_NAME}" \
    --query "StackResources[?ResourceType=='AWS::CloudFormation::Stack' && contains(ResourceStatus, 'FAILED')].PhysicalResourceId" \
    --output text 2>/dev/null || true)"
  if [[ -n "$(echo "${failed_nested}" | tr -d '[:space:]')" ]]; then
    echo "" >&2
    echo "--- Nested stacks in *_FAILED (failure events per nested stack) ---" >&2
    local pid=""
    for pid in ${failed_nested}; do
      [[ -z "${pid}" || "${pid}" == "None" ]] && continue
      echo "" >&2
      echo " Nested stack PhysicalResourceId: ${pid}" >&2
      aws cloudformation describe-stack-events --stack-name "${pid}" --max-items 60 \
        --query "StackEvents[?contains(ResourceStatus, 'FAILED')].[Timestamp,LogicalResourceId,ResourceStatus,ResourceStatusReason]" \
        --output table 2>&2 || echo "(describe-stack-events on nested stack failed)" >&2
    done
  fi
  echo "" >&2
  echo "Tip: full event history in console or: aws cloudformation describe-stack-events --stack-name '${STACK_NAME}'" >&2
  echo "Cognito group drift (AlreadyExists / rename): ./scripts/reconcile-cognito-groups-cfn-import.sh ${STAGE}" >&2
}

# SAM_DISABLE_ROLLBACK=1 keeps failed stacks for inspection (blocks replacement updates on Cognito groups, etc.).
DEPLOY_EXTRA_ARGS=()
if [[ "${SAM_DISABLE_ROLLBACK:-0}" == "1" ]]; then
  DEPLOY_EXTRA_ARGS+=(--disable-rollback)
fi

SAM_DEPLOY_EXIT=0
sam deploy \
  --template-file "${SAM_BUILD_DIR}/template.yaml" \
  --stack-name "${STACK_NAME}" \
  --capabilities CAPABILITY_IAM CAPABILITY_NAMED_IAM CAPABILITY_AUTO_EXPAND \
  --parameter-overrides ${PARAMS} \
  --resolve-s3 \
  --no-confirm-changeset \
  --no-fail-on-empty-changeset \
  ${DEPLOY_EXTRA_ARGS+"${DEPLOY_EXTRA_ARGS[@]}"} \
  ${DEPLOY_SUFFIX+"${DEPLOY_SUFFIX[@]}"} || SAM_DEPLOY_EXIT=$?

if [[ "${SAM_DEPLOY_EXIT}" -ne 0 ]]; then
  rapid_cortex_print_deploy_failure_reason
  exit "${SAM_DEPLOY_EXIT}"
fi

echo ""
echo "✅ SAM deploy finished (stack: ${STACK_NAME})."
echo "   Web app (ECS):   ./scripts/deploy-web-ecs.sh ${STAGE}"
echo "   Marketing (S3): ./scripts/deploy-marketing.sh ${STAGE}"
echo "   Desktop uploads: ./scripts/upload-desktop-downloads.sh ${STAGE} …"
