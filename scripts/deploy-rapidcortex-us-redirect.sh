#!/usr/bin/env bash
# Deploy path-preserving 301s: rapidcortex.us (+ www) → www.nexcortiq.us{path}{query}
#
# Usage:
#   export ROUTE53_HOSTED_ZONE_ID=Zxxxxxxxxxx   # rapidcortex.us public zone
#   bash scripts/deploy-rapidcortex-us-redirect.sh
#
# Optional overrides:
#   REDIRECT_TARGET_HOST=www.nexcortiq.us
#   STACK_NAME=rapidcortex-us-redirect
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck source=scripts/lib/rapid-cortex-aws.sh
source "${ROOT}/scripts/lib/rapid-cortex-aws.sh"

ZONE_ID="${ROUTE53_HOSTED_ZONE_ID:-${RAPIDCORTEX_US_HOSTED_ZONE_ID:-}}"
if [[ -z "${ZONE_ID}" ]]; then
  echo "Set ROUTE53_HOSTED_ZONE_ID to the public hosted zone for rapidcortex.us" >&2
  exit 1
fi

STACK_NAME="${STACK_NAME:-rapidcortex-us-redirect}"
TARGET_HOST="${REDIRECT_TARGET_HOST:-www.nexcortiq.us}"
REGION="${AWS_REGION:-us-east-1}"

echo "Deploying ${STACK_NAME} (rapidcortex.us → https://${TARGET_HOST}{path}) in ${REGION}..."
aws cloudformation deploy \
  --region "${REGION}" \
  --stack-name "${STACK_NAME}" \
  --template-file "${ROOT}/infra/rapidcortex-us-redirect.yaml" \
  --parameter-overrides \
    "Route53HostedZoneId=${ZONE_ID}" \
    "RedirectTargetHost=${TARGET_HOST}" \
    "RootDomainName=rapidcortex.us"

echo "Done. Verify: curl -sI https://www.rapidcortex.us/pricing | rg -i 'HTTP/|location:'"
