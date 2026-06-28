#!/usr/bin/env bash
# Invalidate www.rapidcortex.us CloudFront cache after marketing S3 sync.
#
# Requires AWS_PROFILE=rapid-cortex (account 158961537080) with
# cloudfront:CreateInvalidation on distribution EWZ286WS69KX1.
# If invalidation fails, an admin must run once:
#   ADMIN_AWS_PROFILE=<admin> ./scripts/apply-rapid-cortex-deploy-iam.sh --invalidate-marketing
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck source=scripts/lib/rapid-cortex-aws.sh
source "${ROOT}/scripts/lib/rapid-cortex-aws.sh"

export AWS_PROFILE="${AWS_PROFILE:-rapid-cortex}"
export AWS_REGION="${AWS_REGION:-${RAPID_CORTEX_AWS_REGION}}"

rapid_cortex_invalidate_marketing_cloudfront
