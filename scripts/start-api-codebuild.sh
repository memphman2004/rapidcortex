#!/usr/bin/env bash
set -euo pipefail
# Starts the remote SAM/API deploy (infra/api-pipeline-codebuild.yaml + buildspec.api.yml).
# Usage: ./scripts/start-api-codebuild.sh [dev|staging|prod|pilot]
ENVIRONMENT="${1:-dev}"
AWS_REGION="${AWS_REGION:-${AWS_DEFAULT_REGION:-us-east-1}}"
PROJECT_NAME="${API_CODEBUILD_PROJECT_NAME:-rapid-cortex-api-build-${ENVIRONMENT}}"

echo "Starting CodeBuild project ${PROJECT_NAME}…"

BUILD_ID="$(
  aws codebuild start-build \
    --project-name "${PROJECT_NAME}" \
    --region "${AWS_REGION}" \
    --query 'build.id' \
    --output text
)"

echo "✓ Build id: ${BUILD_ID}"
printf '%s' "${BUILD_ID}" > "${TMPDIR:-/tmp}/rc-api-codebuild-id-${ENVIRONMENT}"
echo "Monitor: https://console.aws.amazon.com/codesuite/codebuild/${AWS_REGION}/projects/${PROJECT_NAME}"
echo ""
echo "Tail logs:  aws logs tail /aws/codebuild/${PROJECT_NAME} --follow --region ${AWS_REGION}"
echo "Poll status: aws codebuild batch-get-builds --ids ${BUILD_ID} --region ${AWS_REGION} \\"
echo "               --query \"builds[0].{Status:buildStatus,Phase:currentPhase}\" --output table"
