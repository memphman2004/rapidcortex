#!/usr/bin/env bash
# Live web (app.rapidcortex.us) — Maps V2 + Safety Source + correct HERE map names.
#   bash "/Volumes/Mac Mini/Coding Projects/Rapid Cortex/.war-room-staging/deploy-web-ecs-prod.sh"
set -euo pipefail
export PATH="/usr/bin:/bin:/usr/sbin:/sbin:/opt/homebrew/bin:${PATH:-}"
export AWS_PROFILE="${AWS_PROFILE:-rapid-cortex}"
export AWS_REGION="${AWS_REGION:-us-east-1}"
export AWS_DEFAULT_REGION="$AWS_REGION"
export ALLOW_EXTERNAL_DRIVE=1
unset HTTP_PROXY HTTPS_PROXY http_proxy https_proxy ALL_PROXY all_proxy no_proxy NO_PROXY || true

ROOT="/Volumes/Mac Mini/Coding Projects/Rapid Cortex"
LOG="${HOME}/.rapid-cortex-sam-build/deploy-web-ecs-prod.log"
EXITF="${HOME}/.rapid-cortex-sam-build/deploy-web-ecs-prod-exit.txt"
mkdir -p "${HOME}/.rapid-cortex-sam-build"
rm -f "$EXITF"
cd "$ROOT"

# shellcheck source=scripts/env-web-ssr-prod.sh
source "${ROOT}/scripts/env-web-ssr-prod.sh"
# Force Maps V2 + live ALS names from rapid-cortex-dev (env script already sets pool).
export NEXT_PUBLIC_ALS_MAP_API_VERSION=v2
export API_STACK=rapid-cortex-dev
export ALS_DEPLOYMENT_STAGE=dev
unset NEXT_PUBLIC_ALS_MAP_NAME NEXT_PUBLIC_ALS_MAP_NAME_DARK
# shellcheck source=scripts/lib/resolve-als-map-env.sh
source "${ROOT}/scripts/lib/resolve-als-map-env.sh"
resolve_als_map_env || true

export WEB_SMOKE_BASE_URL="${WEB_SMOKE_BASE_URL:-https://app.rapidcortex.us}"
export WEB_CLOUDFRONT_DISTRIBUTION_ID="${WEB_CLOUDFRONT_DISTRIBUTION_ID:-E1T1KDP4B7PNW7}"
export WEB_ECR_REPO_NAME="${WEB_ECR_REPO_NAME:-rapid-cortex-web-prod}"
export ECS_CLUSTER_NAME="${ECS_CLUSTER_NAME:-rapid-cortex-v2-web-prod}"
export ECS_SERVICE_NAME="${ECS_SERVICE_NAME:-rapid-cortex-v2-web-prod}"

{
  echo "########## WEB_ECS_PROD $(date -u +%Y-%m-%dT%H:%M:%SZ) ##########"
  echo "ALS bake: map=${NEXT_PUBLIC_ALS_MAP_NAME} dark=${NEXT_PUBLIC_ALS_MAP_NAME_DARK} api=${NEXT_PUBLIC_ALS_MAP_API_VERSION} pool=${NEXT_PUBLIC_ALS_IDENTITY_POOL_ID}"
  bash "${ROOT}/scripts/deploy-web-ecs.sh" prod
  ec=$?
  echo "$ec" > "$EXITF"
  echo "WEB_ECS_EXIT=$ec"
  exit "$ec"
} 2>&1 | tee -a "$LOG"
