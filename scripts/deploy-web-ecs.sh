#!/usr/bin/env bash
set -euo pipefail
# S3ZIP → CodeBuild (Docker inside AWS only) → ECR → pin new image digest on ECS.
#
# IMPORTANT: prod task defs use ECR *@sha256:…* pins. `aws ecs update-service
# --force-new-deployment` alone restarts the **same** pin and will NOT ship a new
# CodeBuild image. This script registers a new task revision with the build digest.
#
# Env:
# - ROLL_ECS_AFTER_CODEBUILD  default **1** (set 0 / SKIP_ECS_ROLL=1 to build+push only)
# - WEB_SMOKE_BASE_URL=https://… run scripts/smoke-web.sh after rollout
# - WEB_CLOUDFRONT_DISTRIBUTION_ID  optional CF invalidation after ECS is stable
# - ECS_CLUSTER_NAME / ECS_SERVICE_NAME  override naming (default rapid-cortex-v2-web-{env})
ENVIRONMENT="${1:?Usage: $0 [dev|staging|prod]}"

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${ROOT}"

case "${ENVIRONMENT}" in
dev | staging | prod) ;;
*)
  echo "Invalid environment: ${ENVIRONMENT} (use dev | staging | prod)" >&2
  exit 1
  ;;
esac

"${ROOT}/scripts/package-web-source.sh" "${ENVIRONMENT}"
"${ROOT}/scripts/upload-web-source.sh" "${ENVIRONMENT}"
"${ROOT}/scripts/start-web-codebuild.sh" "${ENVIRONMENT}"

AWS_REGION="${AWS_REGION:-${AWS_DEFAULT_REGION:-us-east-1}}"

# Default on: a "successful" web deploy must pin the new digest. Opt out only when
# intentionally building an image without rolling (e.g. inspect ECR first).
if [[ "${SKIP_ECS_ROLL:-0}" == "1" ]]; then
  ROLL_ECS_AFTER_CODEBUILD=0
fi
ROLL_ECS_AFTER_CODEBUILD="${ROLL_ECS_AFTER_CODEBUILD:-1}"

if [[ "${ROLL_ECS_AFTER_CODEBUILD}" == "1" ]]; then
  # Override with ECS_CLUSTER_NAME / ECS_SERVICE_NAME if your stack uses a different naming pattern.
  CLUSTER="${ECS_CLUSTER_NAME:-rapid-cortex-v2-web-${ENVIRONMENT}}"
  SVC="${ECS_SERVICE_NAME:-rapid-cortex-v2-web-${ENVIRONMENT}}"

  # --- Step 1: Wait for CodeBuild to complete --------------------------------
  BUILD_ID_FILE="${TMPDIR:-/tmp}/rc-web-codebuild-id-${ENVIRONMENT}"
  if [[ ! -f "${BUILD_ID_FILE}" ]]; then
    echo "✗ Could not find CodeBuild ID file ${BUILD_ID_FILE} — was start-web-codebuild.sh called first?" >&2
    exit 1
  fi
  BUILD_ID="$(cat "${BUILD_ID_FILE}")"
  echo "Waiting for CodeBuild build ${BUILD_ID} to complete (max 30 minutes)…"
  MAX_WAIT=1800
  ELAPSED=0
  while true; do
    CB_STATUS="$(aws codebuild batch-get-builds \
      --ids "${BUILD_ID}" \
      --region "${AWS_REGION}" \
      --query 'builds[0].buildStatus' \
      --output text 2>&1)"
    case "${CB_STATUS}" in
      SUCCEEDED)
        echo "✓ CodeBuild SUCCEEDED"
        break
        ;;
      FAILED|FAULT|TIMED_OUT|STOPPED)
        echo "✗ CodeBuild build ended with status ${CB_STATUS} — aborting ECS rollout" >&2
        exit 1
        ;;
      IN_PROGRESS)
        if (( ELAPSED >= MAX_WAIT )); then
          echo "✗ Timed out after ${MAX_WAIT}s waiting for CodeBuild build ${BUILD_ID}" >&2
          exit 1
        fi
        sleep 5
        ELAPSED=$(( ELAPSED + 5 ))
        ;;
      *)
        echo "✗ Unexpected CodeBuild status '${CB_STATUS}' — aborting" >&2
        exit 1
        ;;
    esac
  done

  # --- Step 2: Retrieve the pushed image digest ----------------------------
  # Prefer the digest printed by `docker push` in the build log over an ECR API call,
  # since the deploy user may not have ecr:DescribeImages.
  IMAGE_DIGEST=""
  BUILD_LOG_GROUP="$(aws codebuild batch-get-builds \
    --ids "${BUILD_ID}" --region "${AWS_REGION}" \
    --query 'builds[0].logs.groupName' --output text 2>/dev/null || true)"
  BUILD_LOG_STREAM="$(aws codebuild batch-get-builds \
    --ids "${BUILD_ID}" --region "${AWS_REGION}" \
    --query 'builds[0].logs.streamName' --output text 2>/dev/null || true)"
  if [[ -n "${BUILD_LOG_GROUP}" && "${BUILD_LOG_GROUP}" != "None" && \
        -n "${BUILD_LOG_STREAM}" && "${BUILD_LOG_STREAM}" != "None" ]]; then
    IMAGE_DIGEST="$(aws logs get-log-events \
      --log-group-name "${BUILD_LOG_GROUP}" \
      --log-stream-name "${BUILD_LOG_STREAM}" \
      --region "${AWS_REGION}" \
      --query 'events[].message' \
      --output text 2>/dev/null | \
      grep -oE 'sha256:[a-f0-9]{64}' | tail -1 || true)"
  fi
  # Fall back to ECR describe-images if log parse didn't yield a digest.
  if [[ -z "${IMAGE_DIGEST}" ]]; then
    ECR_REPO="${WEB_ECR_REPO_NAME:-rapid-cortex-web-${ENVIRONMENT}}"
    IMAGE_DIGEST="$(aws ecr describe-images \
      --repository-name "${ECR_REPO}" \
      --image-ids imageTag=latest \
      --region "${AWS_REGION}" \
      --query 'imageDetails[0].imageDigest' \
      --output text 2>/dev/null || true)"
  fi

  ECR_ACCOUNT="${AWS_ACCOUNT_ID:-$(aws sts get-caller-identity --query Account --output text --region "${AWS_REGION}")}"
  ECR_REGISTRY="${ECR_ACCOUNT}.dkr.ecr.${AWS_REGION}.amazonaws.com"
  ECR_REPO="${WEB_ECR_REPO_NAME:-rapid-cortex-web-${ENVIRONMENT}}"
  if [[ -n "${IMAGE_DIGEST}" && "${IMAGE_DIGEST}" != "None" ]]; then
    echo "✓ Pinned image digest: ${IMAGE_DIGEST}"
    IMAGE_REF="${ECR_REGISTRY}/${ECR_REPO}@${IMAGE_DIGEST}"
  else
    echo "ERROR: Could not retrieve image digest from build logs or ECR." >&2
    echo "  Refusing to roll ECS without a digest pin (force-new-deployment on an old pin ships nothing)." >&2
    exit 1
  fi

  # --- Step 3: Register a new task definition revision pinned to this digest ---
  CURRENT_TASK_DEF_ARN="$(aws ecs describe-services \
    --cluster "${CLUSTER}" --services "${SVC}" \
    --region "${AWS_REGION}" \
    --query 'services[0].taskDefinition' --output text)"
  CURRENT_IMAGE="$(aws ecs describe-task-definition \
    --task-definition "${CURRENT_TASK_DEF_ARN}" \
    --region "${AWS_REGION}" \
    --query 'taskDefinition.containerDefinitions[0].image' --output text)"
  echo "Current task image: ${CURRENT_IMAGE}"
  echo "New task image:     ${IMAGE_REF}"
  if [[ "${CURRENT_IMAGE}" == "${IMAGE_REF}" ]]; then
    echo "WARN: new digest matches the current task definition image — continuing anyway." >&2
  fi
  NEW_TASK_DEF_JSON="$(aws ecs describe-task-definition \
    --task-definition "${CURRENT_TASK_DEF_ARN}" \
    --region "${AWS_REGION}" \
    --query 'taskDefinition' --output json | \
    jq --arg img "${IMAGE_REF}" \
      '.containerDefinitions[0].image = $img |
       del(.taskDefinitionArn,.revision,.status,.requiresAttributes,.compatibilities,.registeredAt,.registeredBy)')"
  NEW_TASK_DEF_ARN="$(aws ecs register-task-definition \
    --cli-input-json "${NEW_TASK_DEF_JSON}" \
    --region "${AWS_REGION}" \
    --query 'taskDefinition.taskDefinitionArn' --output text)"
  echo "✓ Registered task definition: ${NEW_TASK_DEF_ARN}"

  # --- Step 4: Deploy and wait -----------------------------------------------
  echo "Rolling ECS ${CLUSTER}/${SVC} → ${NEW_TASK_DEF_ARN}"
  aws ecs update-service \
    --cluster "${CLUSTER}" \
    --service "${SVC}" \
    --task-definition "${NEW_TASK_DEF_ARN}" \
    --deployment-configuration "maximumPercent=200,minimumHealthyPercent=50,deploymentCircuitBreaker={enable=false,rollback=false}" \
    --region "${AWS_REGION}"
  # Note: aws ecs wait services-stable is hard-capped at ~10 min; use deploy-web-no-docker.sh for
  # long rollouts where the 35-min polling loop is needed.
  aws ecs wait services-stable \
    --cluster "${CLUSTER}" \
    --services "${SVC}" \
    --region "${AWS_REGION}"
  echo "✓ ECS service stable on ${NEW_TASK_DEF_ARN}"

  # --- Step 5: Optional CloudFront invalidation for HTML/nav routes ----------
  CF_DIST="${WEB_CLOUDFRONT_DISTRIBUTION_ID:-}"
  if [[ -z "${CF_DIST}" && "${ENVIRONMENT}" == "prod" ]]; then
    CF_DIST="$(aws cloudformation describe-stacks \
      --stack-name rapid-cortex-web-ssr-prod-v2 \
      --region "${AWS_REGION}" \
      --query "Stacks[0].Outputs[?OutputKey=='CloudFrontDistributionId'].OutputValue" \
      --output text 2>/dev/null || true)"
  fi
  if [[ -n "${CF_DIST}" && "${CF_DIST}" != "None" ]]; then
    echo "Invalidating CloudFront ${CF_DIST} (/, /rc-admin/*, /_next/static/*)…"
    aws cloudfront create-invalidation \
      --distribution-id "${CF_DIST}" \
      --paths "/" "/rc-admin*" "/_next/static/*" \
      --region "${AWS_REGION}" \
      --query 'Invalidation.Id' --output text
  fi
elif [[ "${ROLL_ECS_AFTER_CODEBUILD}" == "0" ]]; then
  echo "SKIP: ECS roll disabled (ROLL_ECS_AFTER_CODEBUILD=0 or SKIP_ECS_ROLL=1)."
  echo "  Image is in ECR only. Do NOT use force-new-deployment alone — register a new"
  echo "  task definition pinned to the new digest (re-run with default roll, or use"
  echo "  deploy-web-no-docker.sh)."
fi

if [[ -n "${WEB_SMOKE_BASE_URL:-}" ]]; then
  echo "Running smoke-web…"
  "${ROOT}/scripts/smoke-web.sh" "${WEB_SMOKE_BASE_URL}"
fi
