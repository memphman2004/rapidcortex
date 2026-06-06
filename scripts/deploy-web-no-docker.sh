#!/usr/bin/env bash
#
# Rapid Cortex — ship the web container without local Docker.
#
# Vs. scripts/deploy-web-ssr.sh:
#   • deploy-web-ssr.sh provisions/updates SSR infrastructure (VPC, ECS, CloudFront, …) via
#     infra/web-ssr-infra-template.yaml (no ECS service — created in Step 6).
#   • This script assumes that stack (and CodeBuild pipeline) already exist, then: zip source →
#     S3 → CodeBuild (builds & pushes image in AWS) → ECS deploy (latest task def from the SSR stack +
#     optional CloudFront invalidation → smoke-web).
#
#   Note: `update-service --force-new-deployment` alone re-rolls the **same** pinned task revision;
#   passing `--task-definition` (family from `TaskDefinitionFamily`) picks up the latest Active
#   revision after `deploy-web-ssr.sh` updates Cognito/API env.
#
# Usage:
#   ./scripts/deploy-web-no-docker.sh prod
#   ENVIRONMENT=staging ./scripts/deploy-web-no-docker.sh   # first arg wins if both set
#
# Env overrides:
#   AWS_REGION                    default us-east-1
#   WEB_PIPELINE_STACK_NAME       default rapid-cortex-web-pipeline-${ENV}
#   WEB_CODEBUILD_PROJECT_NAME    default rapid-cortex-web-build-${ENV}
#   WEB_SSR_STACK_NAME            prod default rapid-cortex-web-ssr-prod-v2; else rapid-cortex-web-ssr-${ENV}
#   WEB_ECR_REPOSITORY_NAME       default rapid-cortex-web-${ENV} (see infra/web-ecr.yaml)
#   ECS_CLUSTER_NAME              prod default rapid-cortex-v2-web-prod; else rapid-cortex-web-${ENV}
#   ECS_SERVICE_NAME              prod default rapid-cortex-v2-web-prod; else rapid-cortex-web-${ENV}
#   ECS_WAIT_MINUTES              default 35 — poll describe-services until stable or timeout
#   ECS_STABILITY_POLL_SECONDS    default 20 — sleep between polls
#   ECS_DEPLOY_FAILED_TASKS_ABORT default 8 — abort if PRIMARY deployment failedTasks reaches this
#   SKIP_CLOUDFRONT_INVALIDATION  set to 1 to skip
#   SKIP_SMOKE                    set to 1 to skip smoke-web.sh
#   SKIP_HOST_ROUTING_VERIFY      set to 1 to skip post-deploy app-vs-www routing gate (prod)
#   SMOKE_WEB_STACK_NAME          passed to smoke (defaults to WEB_SSR_STACK_NAME)
#   SMOKE_REQUIRE_HEALTH_WEB      set to 1 to fail smoke if GET /api/health/web returns 404
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

ENVIRONMENT="${1:-${ENVIRONMENT:-prod}}"
case "${ENVIRONMENT}" in
  dev | staging | prod) ;;
  *)
    echo "Usage: $0 [dev|staging|prod]" >&2
    exit 1
    ;;
esac

if [[ "${ENVIRONMENT}" == "prod" && "${NEXT_PUBLIC_ENABLE_CAD_WRITEBACK:-}" == "1" ]]; then
  echo "ERROR: NEXT_PUBLIC_ENABLE_CAD_WRITEBACK=1 is not allowed for prod until pilot go/no-go and signed CAD writeback addendum." >&2
  exit 1
fi

AWS_REGION="${AWS_REGION:-${AWS_DEFAULT_REGION:-us-east-1}}"
PIPELINE_STACK="${WEB_PIPELINE_STACK_NAME:-rapid-cortex-web-pipeline-${ENVIRONMENT}}"
CODEBUILD_PROJECT="${WEB_CODEBUILD_PROJECT_NAME:-rapid-cortex-web-build-${ENVIRONMENT}}"
ECR_REPO_NAME="${WEB_ECR_REPOSITORY_NAME:-rapid-cortex-web-${ENVIRONMENT}}"

if [[ "${ENVIRONMENT}" == "prod" ]]; then
  _SSR_STACK_DEFAULT="rapid-cortex-web-ssr-prod-v2"
  _ECS_CLUSTER_DEFAULT="rapid-cortex-v2-web-prod"
  _ECS_SERVICE_DEFAULT="rapid-cortex-v2-web-prod"
else
  _SSR_STACK_DEFAULT="rapid-cortex-web-ssr-${ENVIRONMENT}"
  _ECS_CLUSTER_DEFAULT="rapid-cortex-web-${ENVIRONMENT}"
  _ECS_SERVICE_DEFAULT="rapid-cortex-web-${ENVIRONMENT}"
fi
SSR_STACK="${WEB_SSR_STACK_NAME:-${_SSR_STACK_DEFAULT}}"
CLUSTER_NAME="${ECS_CLUSTER_NAME:-${_ECS_CLUSTER_DEFAULT}}"
SERVICE_NAME="${ECS_SERVICE_NAME:-${_ECS_SERVICE_DEFAULT}}"
unset _SSR_STACK_DEFAULT _ECS_CLUSTER_DEFAULT _ECS_SERVICE_DEFAULT

echo "════════════════════════════════════════════════════════"
echo " Rapid Cortex web deploy (no local Docker)"
echo "════════════════════════════════════════════════════════"
echo " Environment:     ${ENVIRONMENT}"
echo " Region:          ${AWS_REGION}"
echo " ECR repo:        ${ECR_REPO_NAME}"
echo " CodeBuild:       ${CODEBUILD_PROJECT}"
echo " Pipeline stack:  ${PIPELINE_STACK}"
echo " SSR stack:       ${SSR_STACK}"
echo " ECS cluster/svc: ${CLUSTER_NAME} / ${SERVICE_NAME}"
echo "════════════════════════════════════════════════════════"
echo ""

# --- Step 1: Preconditions ---
echo "Step 1: Checking infrastructure…"

if ! aws ecr describe-repositories \
  --repository-names "${ECR_REPO_NAME}" \
  --region "${AWS_REGION}" \
  --no-cli-pager &>/dev/null; then
  echo "❌ ECR repository not found: ${ECR_REPO_NAME}" >&2
  echo "   Deploy: aws cloudformation deploy --template-file infra/web-ecr.yaml \\" >&2
  echo "     --stack-name rapid-cortex-web-ecr-${ENVIRONMENT} --parameter-overrides Environment=${ENVIRONMENT} \\" >&2
  echo "     --capabilities CAPABILITY_IAM --region ${AWS_REGION}" >&2
  exit 1
fi
echo "✓ ECR repository exists (${ECR_REPO_NAME})"

cb_len="$(
  aws codebuild batch-get-projects \
    --names "${CODEBUILD_PROJECT}" \
    --region "${AWS_REGION}" \
    --query 'length(projects)' \
    --output text 2>/dev/null || echo 0
)"
if [[ "${cb_len:-0}" -lt 1 ]]; then
  echo "❌ CodeBuild project not found: ${CODEBUILD_PROJECT}" >&2
  echo "   Deploy: aws cloudformation deploy --template-file infra/web-pipeline-codebuild.yaml \\" >&2
  echo "     --stack-name ${PIPELINE_STACK} --parameter-overrides Environment=${ENVIRONMENT} \\" >&2
  echo "     --capabilities CAPABILITY_IAM --region ${AWS_REGION}" >&2
  exit 1
fi
echo "✓ CodeBuild project exists (${CODEBUILD_PROJECT})"

# --- Package + upload ---
echo ""
echo "Step 2: Packaging source…"
"${ROOT}/scripts/package-web-source.sh" "${ENVIRONMENT}"

echo ""
echo "Step 3: Uploading to S3…"
WEB_PIPELINE_STACK_NAME="${PIPELINE_STACK}" "${ROOT}/scripts/upload-web-source.sh" "${ENVIRONMENT}"

echo ""
echo "Step 4: Starting CodeBuild (image build + ECR push in AWS)…"
# Merge non-empty NEXT_PUBLIC_/build-related exports into CodeBuild when present
# (e.g. after sourcing scripts/env-web-ssr-prod.sh). Otherwise stack CodeBuild defaults
# can bake stale API/Cognito URLs into the image.
declare -a _CB_ENV_OVERRIDES=()
for _var_name in \
  NEXT_PUBLIC_API_BASE_URL \
  NEXT_PUBLIC_API_BASE \
  NEXT_PUBLIC_API_BASE_2 \
  NEXT_PUBLIC_COGNITO_REGION \
  NEXT_PUBLIC_COGNITO_USER_POOL_ID \
  NEXT_PUBLIC_COGNITO_CLIENT_ID \
  NEXT_PUBLIC_COGNITO_DOMAIN \
  COGNITO_DOMAIN \
  NEXT_PUBLIC_SITE_URL \
  NEXT_PUBLIC_APP_ORIGIN \
  NEXT_PUBLIC_MARKETING_SITE_URL \
  NEXT_PUBLIC_MAC_DOWNLOAD_URL \
  NEXT_PUBLIC_WINDOWS_DOWNLOAD_URL \
  NEXT_PUBLIC_RC_LITE_DOCS_URL \
  NEXT_PUBLIC_RC_LITE_API_URL \
  NEXT_PUBLIC_ENABLE_DOWNLOADS \
  NEXT_PUBLIC_ENABLE_RC_LITE \
  NEXT_PUBLIC_EXTERNAL_STATUS_PAGE_URL \
  NEXT_PUBLIC_ENABLE_HOSPITAL_ROUTING \
  NEXT_PUBLIC_ENABLE_HOSPITAL_PORTAL \
  NEXT_PUBLIC_ENABLE_EMERGENCY_CONNECT
do
  if [[ -n "${!_var_name:-}" ]]; then
    _CB_ENV_OVERRIDES+=(--environment-variables-override "name=${_var_name},value=${!_var_name},type=PLAINTEXT")
  fi
done
unset _var_name

if [[ ${#_CB_ENV_OVERRIDES[@]} -gt 0 ]]; then
  echo "   CodeBuild: applying ${#_CB_ENV_OVERRIDES[@]} env override(s) from current shell → image build-args."
fi

BUILD_ID="$(
  aws codebuild start-build \
    --project-name "${CODEBUILD_PROJECT}" \
    --region "${AWS_REGION}" \
    "${_CB_ENV_OVERRIDES[@]}" \
    --query 'build.id' \
    --output text \
    --no-cli-pager
)"
unset _CB_ENV_OVERRIDES
echo "Build ID: ${BUILD_ID}"
echo "Console:  https://console.aws.amazon.com/codesuite/codebuild/${AWS_REGION}/projects/${CODEBUILD_PROJECT}/build/${BUILD_ID}"

echo ""
echo "Step 5: Waiting for CodeBuild…"
START_TIME=$(date +%s)
while true; do
  BUILD_STATUS="$(
    aws codebuild batch-get-builds \
      --ids "${BUILD_ID}" \
      --region "${AWS_REGION}" \
      --query 'builds[0].buildStatus' \
      --output text \
      --no-cli-pager
  )"
  CURRENT_PHASE="$(
    aws codebuild batch-get-builds \
      --ids "${BUILD_ID}" \
      --region "${AWS_REGION}" \
      --query 'builds[0].currentPhase' \
      --output text \
      --no-cli-pager
  )"
  ELAPSED=$(( $(date +%s) - START_TIME ))
  case "${BUILD_STATUS}" in
    SUCCEEDED)
      echo "✓ Build succeeded (${ELAPSED}s)"
      break
      ;;
    FAILED|FAULT|STOPPED|TIMED_OUT)
      echo "❌ CodeBuild buildStatus=${BUILD_STATUS}" >&2
      echo "   Note: builds[0].currentPhase is '${CURRENT_PHASE}' after the batch ends (often COMPLETED even on failure)." >&2
      echo "   Phase status (phaseType → phaseStatus):" >&2
      aws codebuild batch-get-builds \
        --ids "${BUILD_ID}" \
        --region "${AWS_REGION}" \
        --query 'builds[0].phases[*].[phaseType,phaseStatus]' \
        --output table \
        --no-cli-pager 2>&2 || true
      echo "   Build ID: ${BUILD_ID}" >&2
      echo "   Console:  https://console.aws.amazon.com/codesuite/codebuild/${AWS_REGION}/projects/${CODEBUILD_PROJECT}/build/${BUILD_ID}" >&2
      echo "   Logs:     aws logs tail /aws/codebuild/${CODEBUILD_PROJECT} --since 30m --region ${AWS_REGION}" >&2
      exit 1
      ;;
    *)
      echo "   … ${BUILD_STATUS} · ${CURRENT_PHASE} · ${ELAPSED}s"
      sleep 15
      ;;
  esac
done

# --- ECS ---
echo ""
echo "Step 6: ECS service (create from stack outputs if missing, else update to latest task definition)…"
ECS_SVC_LEN="$(
  aws ecs describe-services \
    --cluster "${CLUSTER_NAME}" \
    --services "${SERVICE_NAME}" \
    --region "${AWS_REGION}" \
    --query 'length(services)' \
    --output text \
    --no-cli-pager 2>/dev/null || echo 0
)"
ECS_SVC_LEN="${ECS_SVC_LEN//$'\t'/}"
[[ -z "${ECS_SVC_LEN}" || "${ECS_SVC_LEN}" == "None" ]] && ECS_SVC_LEN=0

TASK_FAMILY="$(
  aws cloudformation describe-stacks \
    --stack-name "${SSR_STACK}" \
    --region "${AWS_REGION}" \
    --query "Stacks[0].Outputs[?OutputKey=='TaskDefinitionFamily'].OutputValue | [0]" \
    --output text \
    --no-cli-pager 2>/dev/null || true
)"
if [[ -z "${TASK_FAMILY}" || "${TASK_FAMILY}" == "None" ]]; then
  echo "❌ Missing TaskDefinitionFamily output from stack ${SSR_STACK}." >&2
  exit 1
fi

PREV_TASK_DEF=""
if [[ "${ECS_SVC_LEN}" -ge 1 ]]; then
  PREV_TASK_DEF="$(
    aws ecs describe-services \
      --cluster "${CLUSTER_NAME}" \
      --services "${SERVICE_NAME}" \
      --region "${AWS_REGION}" \
      --query 'services[0].taskDefinition' \
      --output text \
      --no-cli-pager 2>/dev/null || true
  )"
  PREV_TASK_DEF="${PREV_TASK_DEF//$'\t'/}"
  if [[ -n "${PREV_TASK_DEF}" && "${PREV_TASK_DEF}" != "None" ]]; then
    echo "   Previous task definition (rollback target): ${PREV_TASK_DEF}"
  fi
fi

if [[ "${ECS_SVC_LEN}" -lt 1 ]]; then
  echo "ECS service not found — creating (stack ${SSR_STACK})…"
  TG_ARN="$(
    aws cloudformation describe-stacks \
      --stack-name "${SSR_STACK}" \
      --region "${AWS_REGION}" \
      --query "Stacks[0].Outputs[?OutputKey=='AlbTargetGroupArn'].OutputValue | [0]" \
      --output text \
      --no-cli-pager 2>/dev/null || true
  )"
  PRIV_SUBS_CSV="$(
    aws cloudformation describe-stacks \
      --stack-name "${SSR_STACK}" \
      --region "${AWS_REGION}" \
      --query "Stacks[0].Outputs[?OutputKey=='PrivateSubnetIdsCsv'].OutputValue | [0]" \
      --output text \
      --no-cli-pager 2>/dev/null || true
  )"
  ECS_SG="$(
    aws cloudformation describe-stacks \
      --stack-name "${SSR_STACK}" \
      --region "${AWS_REGION}" \
      --query "Stacks[0].Outputs[?OutputKey=='EcsSecurityGroupId'].OutputValue | [0]" \
      --output text \
      --no-cli-pager 2>/dev/null || true
  )"
  ASSIGN_PUB="$(
    aws cloudformation describe-stacks \
      --stack-name "${SSR_STACK}" \
      --region "${AWS_REGION}" \
      --query "Stacks[0].Outputs[?OutputKey=='EcsAssignPublicIpValue'].OutputValue | [0]" \
      --output text \
      --no-cli-pager 2>/dev/null || true
  )"
  DESIRED_CNT="$(
    aws cloudformation describe-stacks \
      --stack-name "${SSR_STACK}" \
      --region "${AWS_REGION}" \
      --query "Stacks[0].Outputs[?OutputKey=='EcsDesiredCount'].OutputValue | [0]" \
      --output text \
      --no-cli-pager 2>/dev/null || true
  )"
  GRACE_SEC="$(
    aws cloudformation describe-stacks \
      --stack-name "${SSR_STACK}" \
      --region "${AWS_REGION}" \
      --query "Stacks[0].Outputs[?OutputKey=='EcsHealthCheckGracePeriodSecondsValue'].OutputValue | [0]" \
      --output text \
      --no-cli-pager 2>/dev/null || true
  )"
  for v in TG_ARN PRIV_SUBS_CSV ECS_SG ASSIGN_PUB DESIRED_CNT GRACE_SEC; do
    eval "vv=\${${v}}"
    if [[ -z "${vv}" || "${vv}" == "None" ]]; then
      echo "❌ Missing CloudFormation output ${v} from stack ${SSR_STACK} (need AlbTargetGroupArn, PrivateSubnetIdsCsv, EcsSecurityGroupId, EcsAssignPublicIpValue, EcsDesiredCount, EcsHealthCheckGracePeriodSecondsValue)." >&2
      exit 1
    fi
  done

  aws ecs create-service \
    --cluster "${CLUSTER_NAME}" \
    --service-name "${SERVICE_NAME}" \
    --task-definition "${TASK_FAMILY}" \
    --desired-count "${DESIRED_CNT}" \
    --launch-type FARGATE \
    --platform-version LATEST \
    --network-configuration "awsvpcConfiguration={subnets=[${PRIV_SUBS_CSV}],securityGroups=[${ECS_SG}],assignPublicIp=${ASSIGN_PUB}}" \
    --load-balancers "targetGroupArn=${TG_ARN},containerName=nextjs-web,containerPort=3000" \
    --health-check-grace-period-seconds "${GRACE_SEC}" \
    --deployment-configuration "maximumPercent=200,minimumHealthyPercent=50,deploymentCircuitBreaker={enable=false,rollback=false}" \
    --region "${AWS_REGION}" \
    --no-cli-pager >/dev/null
  echo "✓ ECS service created"
else
  aws ecs update-service \
    --cluster "${CLUSTER_NAME}" \
    --service "${SERVICE_NAME}" \
    --task-definition "${TASK_FAMILY}" \
    --force-new-deployment \
    --region "${AWS_REGION}" \
    --no-cli-pager >/dev/null
  echo "✓ ECS update triggered (task definition family: ${TASK_FAMILY} → latest revision)"
fi

echo ""
echo "Step 7: Waiting for ECS service stability…"
# `aws ecs wait services-stable` is hard-capped (~40×15s ≈ 10m); AWS_MAX_ATTEMPTS does not extend waiter polls.
# We poll describe-services instead: exit when running==desired && pending==0, or early-abort on crash-loop signals.
ECS_WAIT_MINUTES="${ECS_WAIT_MINUTES:-35}"
ECS_STABILITY_POLL_SECONDS="${ECS_STABILITY_POLL_SECONDS:-20}"
ECS_DEPLOY_FAILED_TASKS_ABORT="${ECS_DEPLOY_FAILED_TASKS_ABORT:-8}"
deadline=$(( $(date +%s) + ECS_WAIT_MINUTES * 60 ))
stable_ok=""
while (( $(date +%s) < deadline )); do
  counts="$(
    aws ecs describe-services \
      --cluster "${CLUSTER_NAME}" \
      --services "${SERVICE_NAME}" \
      --region "${AWS_REGION}" \
      --query 'services[0].[runningCount,desiredCount,pendingCount]' \
      --output text \
      --no-cli-pager 2>/dev/null || echo ""
  )"
  if [[ -z "${counts}" || "${counts}" == "None" ]]; then
    echo "   ⚠ describe-services returned empty; retrying…"
    sleep "${ECS_STABILITY_POLL_SECONDS}"
    continue
  fi
  IFS=$'\t' read -r running desired pending <<< "${counts}"

  primary_failed="$(
    aws ecs describe-services \
      --cluster "${CLUSTER_NAME}" \
      --services "${SERVICE_NAME}" \
      --region "${AWS_REGION}" \
      --query 'services[0].deployments[?status==`PRIMARY`].failedTasks | [0]' \
      --output text \
      --no-cli-pager 2>/dev/null || echo "0"
  )"
  primary_failed="${primary_failed//$'\t'/}"
  [[ -z "${primary_failed}" || "${primary_failed}" == "None" ]] && primary_failed=0

  rollout="$(
    aws ecs describe-services \
      --cluster "${CLUSTER_NAME}" \
      --services "${SERVICE_NAME}" \
      --region "${AWS_REGION}" \
      --query 'services[0].deployments[?status==`PRIMARY`].rolloutState | [0]' \
      --output text \
      --no-cli-pager 2>/dev/null || echo ""
  )"

  echo "   … running=${running} desired=${desired} pending=${pending} primary_failed=${primary_failed} rollout=${rollout}"

  if [[ "${running}" == "${desired}" && "${pending}" == "0" ]]; then
    stable_ok=1
    break
  fi

  if [[ "${primary_failed}" =~ ^[0-9]+$ ]] && (( primary_failed >= ECS_DEPLOY_FAILED_TASKS_ABORT )); then
    echo "❌ PRIMARY deployment failedTasks=${primary_failed} (threshold ${ECS_DEPLOY_FAILED_TASKS_ABORT}) — likely crash loop or failed health checks." >&2
    echo "   aws ecs describe-services --cluster ${CLUSTER_NAME} --services ${SERVICE_NAME} --region ${AWS_REGION} \\" >&2
    echo "     --query 'services[0].events[0:12].[createdAt,message]' --output table" >&2
    echo "   aws ecs list-tasks --cluster ${CLUSTER_NAME} --service-name ${SERVICE_NAME} --desired-status STOPPED --region ${AWS_REGION}" >&2
    echo "   aws logs tail /ecs/${SERVICE_NAME} --region ${AWS_REGION} --since 30m" >&2
    exit 1
  fi

  sleep "${ECS_STABILITY_POLL_SECONDS}"
done

if [[ -z "${stable_ok}" ]]; then
  echo "❌ ECS did not reach running==desired && pending==0 within ${ECS_WAIT_MINUTES}m." >&2
  echo "   (This is weaker than AWS's full services-stable; use describe-services + events if unsure.)" >&2
  echo "   aws ecs describe-services --cluster ${CLUSTER_NAME} --services ${SERVICE_NAME} --region ${AWS_REGION} \\" >&2
  echo "     --query 'services[0].{running:runningCount,desired:desiredCount,pending:pendingCount,events:events[0:8]}' --output json" >&2
  exit 1
fi
echo "✓ ECS stable (running=${running} desired=${desired} pending=${pending})"

# --- CloudFront ---
if [[ "${SKIP_CLOUDFRONT_INVALIDATION:-0}" != "1" ]]; then
  echo ""
  echo "Step 8: CloudFront invalidation…"
  DIST_ID="$(
    aws cloudformation describe-stacks \
      --stack-name "${SSR_STACK}" \
      --region "${AWS_REGION}" \
      --query "Stacks[0].Outputs[?OutputKey=='CloudFrontDistributionId'].OutputValue | [0]" \
      --output text \
      --no-cli-pager 2>/dev/null || true
  )"
  DIST_ID="${DIST_ID//$'\t'/}"
  if [[ -n "${DIST_ID}" && "${DIST_ID}" != "None" ]]; then
    aws cloudfront create-invalidation \
      --distribution-id "${DIST_ID}" \
      --paths "/*" \
      --no-cli-pager >/dev/null
    echo "✓ Invalidation started for distribution ${DIST_ID}"
  else
    echo "⚠ No CloudFrontDistributionId output on stack ${SSR_STACK} — skipping invalidation"
  fi
else
  echo ""
  echo "Step 8: Skipping CloudFront invalidation (SKIP_CLOUDFRONT_INVALIDATION=1)"
fi

# --- Smoke ---
if [[ "${SKIP_SMOKE:-0}" != "1" ]]; then
  echo ""
  echo "Step 9: Smoke tests…"
  sleep "${SMOKE_DELAY_SECONDS:-10}"
  export DEPLOY_STAGE="${ENVIRONMENT}"
  export STAGE="${ENVIRONMENT}"
  export SMOKE_WEB_STACK_NAME="${SMOKE_WEB_STACK_NAME:-${SSR_STACK}}"
  export SMOKE_REQUIRE_HEALTH_WEB="${SMOKE_REQUIRE_HEALTH_WEB:-0}"
  "${ROOT}/scripts/smoke-web.sh" --
else
  echo ""
  echo "Step 9: Skipped (SKIP_SMOKE=1)"
fi

if [[ "${SKIP_HOST_ROUTING_VERIFY:-0}" != "1" && "${ENVIRONMENT}" == "prod" ]]; then
  echo ""
  echo "Step 10: Host routing verification (app subdomain vs www)…"
  export APP_ORIGIN="${NEXT_PUBLIC_APP_ORIGIN:-https://app.rapidcortex.us}"
  export WWW_ORIGIN="${NEXT_PUBLIC_MARKETING_SITE_URL:-https://www.rapidcortex.us}"
  ALB_DNS="$(
    aws cloudformation describe-stacks \
      --stack-name "${SSR_STACK}" \
      --region "${AWS_REGION}" \
      --query "Stacks[0].Outputs[?OutputKey=='AlbDnsName'].OutputValue | [0]" \
      --output text \
      --no-cli-pager 2>/dev/null || true
  )"
  ALB_DNS="${ALB_DNS//$'\t'/}"
  if [[ -n "${ALB_DNS}" && "${ALB_DNS}" != "None" ]]; then
    export ROUTING_VERIFY_ALB_ORIGIN="https://${ALB_DNS}"
    echo "   App-host checks via ALB HTTPS (${ROUTING_VERIFY_ALB_ORIGIN}) with Host: app.rapidcortex.us"
  else
    echo "   ⚠ AlbDnsName not found — app checks via CloudFront with cache-bust (may false-fail on CDN HIT)"
  fi
  if ! "${ROOT}/scripts/verify-host-routing.sh"; then
    if [[ -n "${PREV_TASK_DEF}" && "${PREV_TASK_DEF}" != "None" ]]; then
      echo "❌ Host routing failed — rolling back ECS to ${PREV_TASK_DEF}…" >&2
      aws ecs update-service \
        --cluster "${CLUSTER_NAME}" \
        --service "${SERVICE_NAME}" \
        --task-definition "${PREV_TASK_DEF}" \
        --force-new-deployment \
        --region "${AWS_REGION}" \
        --no-cli-pager >/dev/null
      echo "   Rollback triggered; verify with: aws ecs describe-services --cluster ${CLUSTER_NAME} --services ${SERVICE_NAME} --region ${AWS_REGION}"
    else
      echo "   No previous task definition captured — manual rollback required." >&2
    fi
    exit 1
  fi
  echo "✓ Host routing verified"
else
  echo ""
  if [[ "${ENVIRONMENT}" != "prod" ]]; then
    echo "Step 10: Skipped host routing gate (non-prod environment)"
  else
    echo "Step 10: Skipped host routing gate (SKIP_HOST_ROUTING_VERIFY=1)"
  fi
fi

ORIGIN_URL="$(
  aws cloudformation describe-stacks \
    --stack-name "${SSR_STACK}" \
    --region "${AWS_REGION}" \
    --query "Stacks[0].Outputs[?OutputKey=='CloudFrontDomainName'].OutputValue | [0]" \
    --output text \
    --no-cli-pager 2>/dev/null || true
)"

echo ""
echo "════════════════════════════════════════════════════════"
echo " ✅ Web deploy pipeline finished"
echo "════════════════════════════════════════════════════════"
if [[ -n "${ORIGIN_URL}" && "${ORIGIN_URL}" != "None" ]]; then
  echo " CloudFront URL: https://${ORIGIN_URL}"
else
  echo " (Resolve URL from stack ${SSR_STACK} output CloudFrontDomainName)"
fi
echo "════════════════════════════════════════════════════════"
