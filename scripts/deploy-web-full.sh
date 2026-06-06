#!/usr/bin/env bash
#
# Rapid Cortex — full local-Docker path: build Dockerfile.web, push to ECR, roll ECS, smoke.
# For CodeBuild/S3 (no local Docker), use scripts/deploy-web-no-docker.sh instead.
#
# Prerequisites: Docker, AWS CLI, ECR repo rapid-cortex-web-${ENV} (see infra/web-ecr.yaml).
#
# Usage:
#   ./scripts/deploy-web-full.sh prod
#
# Optional env (override build args):
#   AWS_REGION                   default us-east-1
#   NEXT_PUBLIC_API_BASE_URL    default https://api.rapidcortex.us
#   APP_ENV                     default production
#   IMAGE_TAG                   default short git SHA or "manual"
#   SKIP_SMOKE                  set to 1 to skip smoke-web.sh
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

AWS_REGION="${AWS_REGION:-${AWS_DEFAULT_REGION:-us-east-1}}"
AWS_ACCOUNT_ID="$(aws sts get-caller-identity --query Account --output text --region "${AWS_REGION}")"
ECR_REPO="${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/rapid-cortex-web-${ENVIRONMENT}"
IMAGE_TAG="${IMAGE_TAG:-$(git -C "${ROOT}" rev-parse --short HEAD 2>/dev/null || echo manual)}"
NEXT_PUBLIC_API_BASE_URL="${NEXT_PUBLIC_API_BASE_URL:-https://api.rapidcortex.us}"
APP_ENV="${APP_ENV:-production}"

echo "════════════════════════════════════════════════════════"
echo " Rapid Cortex web — local Docker → ECR → ECS"
echo "════════════════════════════════════════════════════════"
echo " Environment:  ${ENVIRONMENT}"
echo " Region:       ${AWS_REGION}"
echo " ECR:          ${ECR_REPO}"
echo " Tags:         ${IMAGE_TAG}, latest"
echo "════════════════════════════════════════════════════════"
echo ""

echo "Step 1: ECR login…"
aws ecr get-login-password --region "${AWS_REGION}" \
  | docker login --username AWS --password-stdin "${ECR_REPO%%/*}"

echo "Step 2: docker build…"
docker build \
  -f "${ROOT}/Dockerfile.web" \
  -t "${ECR_REPO}:${IMAGE_TAG}" \
  -t "${ECR_REPO}:latest" \
  --build-arg "NEXT_PUBLIC_API_BASE_URL=${NEXT_PUBLIC_API_BASE_URL}" \
  --build-arg "APP_ENV=${APP_ENV}" \
  "${ROOT}"

echo "Step 3: docker push…"
docker push "${ECR_REPO}:${IMAGE_TAG}"
docker push "${ECR_REPO}:latest"
echo "✓ Image pushed: ${ECR_REPO}:${IMAGE_TAG}"
echo ""

echo "Step 4: ECS force new deployment…"
aws ecs update-service \
  --cluster "rapid-cortex-web-${ENVIRONMENT}" \
  --service "rapid-cortex-web-${ENVIRONMENT}" \
  --force-new-deployment \
  --region "${AWS_REGION}" \
  --no-cli-pager >/dev/null

echo "Step 5: Waiting for service stable…"
aws ecs wait services-stable \
  --cluster "rapid-cortex-web-${ENVIRONMENT}" \
  --services "rapid-cortex-web-${ENVIRONMENT}" \
  --region "${AWS_REGION}" \
  --no-cli-pager
echo "✓ ECS deployment complete"
echo ""

if [[ "${SKIP_SMOKE:-0}" != "1" ]]; then
  echo "Step 6: Smoke tests…"
  export DEPLOY_STAGE="${ENVIRONMENT}"
  export STAGE="${ENVIRONMENT}"
  export SMOKE_WEB_STACK_NAME="${SMOKE_WEB_STACK_NAME:-rapid-cortex-web-ssr-${ENVIRONMENT}}"
  "${ROOT}/scripts/smoke-web.sh" --
else
  echo "Step 6: Skipped (SKIP_SMOKE=1)"
fi

echo ""
echo "════════════════════════════════════════════════════════"
echo " ✅ Full deploy finished"
echo "════════════════════════════════════════════════════════"
