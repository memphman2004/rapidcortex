#!/usr/bin/env bash
set -euo pipefail
# S3ZIP → CodeBuild (Docker inside AWS only) → ECR — no Docker Desktop / no GitHub.
#
# Optional:
# - ROLL_ECS_AFTER_CODEBUILD=1 ecs update-service + wait (override ECS_CLUSTER_NAME / ECS_SERVICE_NAME if needed)
# - WEB_SMOKE_BASE_URL=https://… run scripts/smoke-web.sh after rollout
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

if [[ "${ROLL_ECS_AFTER_CODEBUILD:-0}" == "1" ]]; then
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
    echo "WARN: Could not retrieve image digest from build logs or ECR. Falling back to :latest." >&2
    IMAGE_REF="${ECR_REGISTRY}/${ECR_REPO}:latest"
  fi

  # --- Step 3: Register a new task definition revision pinned to this digest ---
  CURRENT_TASK_DEF_ARN="$(aws ecs describe-services \
    --cluster "${CLUSTER}" --services "${SVC}" \
    --region "${AWS_REGION}" \
    --query 'services[0].taskDefinition' --output text)"
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
  echo "ROLL_ECS_AFTER_CODEBUILD=1 → ecs update-service ${CLUSTER}/${SVC} → ${NEW_TASK_DEF_ARN}"
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
fi

if [[ -n "${WEB_SMOKE_BASE_URL:-}" ]]; then
  echo "Running smoke-web…"
  "${ROOT}/scripts/smoke-web.sh" "${WEB_SMOKE_BASE_URL}"
fi
