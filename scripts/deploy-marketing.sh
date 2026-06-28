#!/usr/bin/env bash
set -euo pipefail
# Deploy marketing static site (build → verify → S3 sync → post-verify → CloudFront invalidation).
#
# Usage:
#   ./scripts/deploy-marketing.sh              # content deploy (default)
#   ./scripts/deploy-marketing.sh --hosting    # S3 + CloudFront CloudFormation stack only
#   ./scripts/deploy-marketing.sh --skip-build # sync existing apps/marketing/out
#
# Prefer: npm run deploy:marketing
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

MODE="content"
SKIP_BUILD=0
STAGE="${DEPLOYMENT_STAGE:-prod}"

# shellcheck source=scripts/lib/rapid-cortex-aws.sh
source "${ROOT}/scripts/lib/rapid-cortex-aws.sh"
export AWS_PROFILE="${AWS_PROFILE:-rapid-cortex}"
export AWS_REGION="${AWS_REGION:-${RAPID_CORTEX_AWS_REGION}}"

for arg in "$@"; do
  case "${arg}" in
  --hosting | --infra | --stack)
    MODE="hosting"
    ;;
  --skip-build)
    SKIP_BUILD=1
    ;;
  dev | staging | prod | pilot)
    STAGE="${arg}"
    export DEPLOYMENT_STAGE="${STAGE}"
    ;;
  --help | -h)
    sed -n '2,12p' "$0"
    exit 0
    ;;
  *)
    echo "Unknown argument: ${arg} (try --help)" >&2
    exit 1
    ;;
  esac
done

if [[ "${MODE}" == "hosting" ]]; then
  export DEPLOYMENT_STAGE="${STAGE}"
  exec "${ROOT}/scripts/deploy-web-hosting.sh"
fi

if [[ "${SKIP_BUILD}" -eq 0 ]]; then
  bash "${ROOT}/scripts/build-marketing.sh"
fi

rapid_cortex_assert_aws_account

bash "${ROOT}/scripts/verify-marketing-static.sh"
bash "${ROOT}/scripts/sync-marketing-to-s3.sh"

echo ""
echo "Marketing content deploy complete."
echo "  Site: https://www.rapidcortex.us"
echo "  Account: ${RAPID_CORTEX_AWS_ACCOUNT_ID}"
echo "  Manifest: s3://${RAPID_CORTEX_MARKETING_S3_BUCKET}/.well-known/marketing-build.json"
