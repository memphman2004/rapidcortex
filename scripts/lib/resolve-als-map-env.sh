#!/usr/bin/env bash
# Resolve ALS public map env from CloudFormation / SSM without printing secrets.
# Usage: source scripts/lib/resolve-als-map-env.sh && resolve_als_map_env

resolve_als_map_env() {
  local stage="${DEPLOYMENT_STAGE:-${STAGE:-${ENVIRONMENT:-dev}}}"
  local region="${AWS_REGION:-${AWS_DEFAULT_REGION:-us-east-1}}"
  local stack="${API_STACK:-rapid-cortex-${stage}}"
  local ssm_name="${ALS_IDENTITY_POOL_SSM_PARAMETER:-/rapidcortex/${stage}/als/identity-pool-id}"

  export NEXT_PUBLIC_ALS_REGION="${NEXT_PUBLIC_ALS_REGION:-${region}}"
  export NEXT_PUBLIC_ALS_MAP_NAME="${NEXT_PUBLIC_ALS_MAP_NAME:-rc-map-${stage}}"
  export NEXT_PUBLIC_ALS_MAP_NAME_DARK="${NEXT_PUBLIC_ALS_MAP_NAME_DARK:-rc-map-dark-${stage}}"
  export NEXT_PUBLIC_ALS_PLACE_INDEX_NAME="${NEXT_PUBLIC_ALS_PLACE_INDEX_NAME:-rc-places-${stage}}"
  export NEXT_PUBLIC_ALS_ROUTE_CALCULATOR_NAME="${NEXT_PUBLIC_ALS_ROUTE_CALCULATOR_NAME:-rc-routes-${stage}}"
  export NEXT_PUBLIC_ALS_GEOFENCE_COLLECTION="${NEXT_PUBLIC_ALS_GEOFENCE_COLLECTION:-rc-geofences-${stage}}"
  export NEXT_PUBLIC_ALS_TRACKER_NAME="${NEXT_PUBLIC_ALS_TRACKER_NAME:-rc-tracker-${stage}}"

  if [[ -z "${NEXT_PUBLIC_ALS_IDENTITY_POOL_ID:-}" || "${NEXT_PUBLIC_ALS_IDENTITY_POOL_ID}" == "us-east-1:REPLACE_WITH_IDENTITY_POOL_ID" ]]; then
    local from_ssm
    from_ssm="$(aws ssm get-parameter --name "${ssm_name}" --region "${region}" --query "Parameter.Value" --output text 2>/dev/null || true)"
    if [[ -n "${from_ssm}" && "${from_ssm}" != "None" ]]; then
      export NEXT_PUBLIC_ALS_IDENTITY_POOL_ID="${from_ssm}"
    else
      local from_cf
      from_cf="$(aws cloudformation describe-stacks \
        --stack-name "${stack}" \
        --region "${region}" \
        --query "Stacks[0].Outputs[?OutputKey=='MapIdentityPoolId'].OutputValue | [0]" \
        --output text 2>/dev/null || true)"
      if [[ -n "${from_cf}" && "${from_cf}" != "None" ]]; then
        export NEXT_PUBLIC_ALS_IDENTITY_POOL_ID="${from_cf}"
      fi
    fi
  fi

  if [[ -n "${NEXT_PUBLIC_ALS_IDENTITY_POOL_ID:-}" && "${NEXT_PUBLIC_ALS_IDENTITY_POOL_ID}" != "None" ]]; then
    return 0
  fi
  return 1
}
