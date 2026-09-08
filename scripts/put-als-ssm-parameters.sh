#!/usr/bin/env bash
# Store ALS Identity Pool ID in SSM after CloudFormation deploy.
# Usage:
#   STAGE=dev IDENTITY_POOL_ID="us-east-1:..." ./scripts/put-als-ssm-parameters.sh
set -euo pipefail

REGION="${AWS_REGION:-us-east-1}"
STAGE="${STAGE:-dev}"
NAME="/rapidcortex/${STAGE}/als/identity-pool-id"
VALUE="${IDENTITY_POOL_ID:-${NEXT_PUBLIC_ALS_IDENTITY_POOL_ID:-}}"

if [[ -z "${VALUE}" ]]; then
  echo "ERROR: Set IDENTITY_POOL_ID or NEXT_PUBLIC_ALS_IDENTITY_POOL_ID" >&2
  exit 1
fi

aws ssm put-parameter \
  --name "${NAME}" \
  --value "${VALUE}" \
  --type String \
  --overwrite \
  --region "${REGION}" \
  --description "ALS Cognito Identity Pool ID for ${STAGE} web map tiles"

echo "Wrote ${NAME}"
