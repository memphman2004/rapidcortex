#!/usr/bin/env bash
set -euo pipefail
ENVIRONMENT="${1:-dev}"
AWS_REGION="${AWS_REGION:-${AWS_DEFAULT_REGION:-us-east-1}}"
PROJECT_NAME="${WEB_CODEBUILD_PROJECT_NAME:-rapid-cortex-web-build-${ENVIRONMENT}}"

echo "Starting CodeBuild project ${PROJECT_NAME}…"
BUILD_ID="$(
  aws codebuild start-build \
    --project-name "${PROJECT_NAME}" \
    --query 'build.id' \
    --output text \
    --region "${AWS_REGION}"
)"

echo "✓ Build id: ${BUILD_ID}"
REG="${AWS_REGION:-}"
echo "Monitor: https://console.aws.amazon.com/codesuite/codebuild/${REG}/projects/${PROJECT_NAME}"
echo ""
echo "After the image pushes, roll ECS (adjust cluster/service if your stack differs):"
echo "  aws ecs update-service --cluster rapid-cortex-v2-web-${ENVIRONMENT} --service rapid-cortex-v2-web-${ENVIRONMENT} --force-new-deployment --region ${AWS_REGION}"
