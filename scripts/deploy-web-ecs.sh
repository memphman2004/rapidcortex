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
  echo "ROLL_ECS_AFTER_CODEBUILD=1 → ecs update-service --force-new-deployment ${CLUSTER}/${SVC}"
  aws ecs update-service \
    --cluster "${CLUSTER}" \
    --service "${SVC}" \
    --force-new-deployment \
    --region "${AWS_REGION}"
  aws ecs wait services-stable \
    --cluster "${CLUSTER}" \
    --services "${SVC}" \
    --region "${AWS_REGION}"
fi

if [[ -n "${WEB_SMOKE_BASE_URL:-}" ]]; then
  echo "Running smoke-web…"
  "${ROOT}/scripts/smoke-web.sh" "${WEB_SMOKE_BASE_URL}"
fi
