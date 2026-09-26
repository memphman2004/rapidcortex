#!/usr/bin/env bash
# NexCortiQ Loadout — SSM Parameter Setup
set -euo pipefail

STAGE="${STAGE:-dev}"
AWS_REGION="${AWS_REGION:-us-east-1}"
AWS_PROFILE="${AWS_PROFILE:-rapid-cortex}"
FROM_EMAIL="${FROM_EMAIL:-billing@rapidcortex.us}"
ADMIN_EMAIL="${ADMIN_EMAIL:-ops@rapidcortex.us}"

put_param() {
  local name="$1"
  local value="$2"
  echo "Putting ${name}"
  aws ssm put-parameter \
    --profile "${AWS_PROFILE}" \
    --region "${AWS_REGION}" \
    --name "${name}" \
    --value "${value}" \
    --type String \
    --overwrite \
    --no-cli-pager >/dev/null
}

# Canonical paths from Loadout build prompt (gate checks these)
put_param "/rapid-cortex/loadout/from-email" "${FROM_EMAIL}"
put_param "/rapid-cortex/loadout/admin-email" "${ADMIN_EMAIL}"
# Stage-scoped copies for multi-env
put_param "/rapid-cortex/loadout/${STAGE}/from-email" "${FROM_EMAIL}"
put_param "/rapid-cortex/loadout/${STAGE}/admin-email" "${ADMIN_EMAIL}"

echo "Done. Verify: aws ssm get-parameter --name /rapid-cortex/loadout/from-email --profile ${AWS_PROFILE}"
