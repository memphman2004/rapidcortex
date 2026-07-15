#!/usr/bin/env bash
set -euo pipefail
ENVIRONMENT="${1:-dev}"
AWS_REGION="${AWS_REGION:-${AWS_DEFAULT_REGION:-us-east-1}}"
PROJECT_NAME="${WEB_CODEBUILD_PROJECT_NAME:-rapid-cortex-web-build-${ENVIRONMENT}}"

echo "Starting CodeBuild project ${PROJECT_NAME}…"

# Optional: pass stack API bases into the Docker build (NEXT_PUBLIC_API_BASE_*).
CB_ENV_OVERRIDES=()
for key in \
  NEXT_PUBLIC_API_BASE_3 NEXT_PUBLIC_API_BASE_4 NEXT_PUBLIC_API_BASE_5 \
  NEXT_PUBLIC_SITE_URL NEXT_PUBLIC_APP_ORIGIN \
  NEXT_PUBLIC_COGNITO_USER_POOL_ID NEXT_PUBLIC_COGNITO_CLIENT_ID NEXT_PUBLIC_COGNITO_REGION NEXT_PUBLIC_COGNITO_DOMAIN \
  NEXT_PUBLIC_ENABLE_SMS_LOCATION NEXT_PUBLIC_WEBSOCKET_URL NEXT_PUBLIC_DEFAULT_PLAN; do
  val="${!key:-}"
  if [[ -n "${val}" ]]; then
    CB_ENV_OVERRIDES+=( "name=${key},value=${val},type=PLAINTEXT" )
  fi
done

START_BUILD_ARGS=( --project-name "${PROJECT_NAME}" --region "${AWS_REGION}" )
if ((${#CB_ENV_OVERRIDES[@]} > 0)); then
  START_BUILD_ARGS+=( --environment-variables-override "${CB_ENV_OVERRIDES[@]}" )
fi

BUILD_ID="$(
  aws codebuild start-build \
    "${START_BUILD_ARGS[@]}" \
    --query 'build.id' \
    --output text
)"

echo "✓ Build id: ${BUILD_ID}"
# Write BUILD_ID to a temp file so callers (e.g. deploy-web-ecs.sh) can poll the build result.
printf '%s' "${BUILD_ID}" > "${TMPDIR:-/tmp}/rc-web-codebuild-id-${ENVIRONMENT}"
REG="${AWS_REGION:-}"
echo "Monitor: https://console.aws.amazon.com/codesuite/codebuild/${REG}/projects/${PROJECT_NAME}"
echo ""
echo "Next: prefer ./scripts/deploy-web-ecs.sh ${ENVIRONMENT} (waits for CodeBuild, pins the new"
echo "  ECR digest on a new ECS task definition, then rolls the service)."
echo "Do NOT use update-service --force-new-deployment alone — prod pins *@sha256:…* so that"
echo "  only restarts the previous image and new routes (e.g. /rc-admin/leads) stay 404."
