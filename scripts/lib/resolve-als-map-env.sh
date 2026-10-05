#!/usr/bin/env bash
# Resolve ALS public map env from CloudFormation / SSM without printing secrets.
# Usage: source scripts/lib/resolve-als-map-env.sh && resolve_als_map_env
#
# Canonical live values come from AppSamLocation / rapid-cortex-{stage} outputs:
#   AlsMapName / AlsMapNameDark / MapIdentityPoolId
# Do NOT hardcode Esri `rc-map-{stage}` when stack outputs say HERE maps, and do not
# ship Maps V2 without geo-maps:GetStyleDescriptor on the Cognito map roles.
#
# Live note: web CodeBuild env is `prod`, but API/ALS live on DeploymentStage=dev
# (stack rapid-cortex-dev, maps rc-map-here-dev). Prefer API_STACK / ALS_DEPLOYMENT_STAGE.

resolve_als_map_env() {
  local web_env="${WEB_DEPLOY_ENVIRONMENT:-${ENVIRONMENT:-dev}}"
  # ALS physical names follow the API SAM stage, not the web ECR env name.
  local stage="${ALS_DEPLOYMENT_STAGE:-${DEPLOYMENT_STAGE:-${STAGE:-}}}"
  if [[ -z "${stage}" ]]; then
    if [[ "${web_env}" == "prod" ]]; then
      stage="dev"
    else
      stage="${web_env}"
    fi
  fi
  local region="${AWS_REGION:-${AWS_DEFAULT_REGION:-us-east-1}}"
  local stack="${API_STACK:-}"
  if [[ -z "${stack}" ]]; then
    if [[ "${web_env}" == "prod" ]]; then
      stack="rapid-cortex-dev"
    else
      stack="rapid-cortex-${stage}"
    fi
  fi
  local ssm_name="${ALS_IDENTITY_POOL_SSM_PARAMETER:-/rapidcortex/${stage}/als/identity-pool-id}"

  export NEXT_PUBLIC_ALS_REGION="${NEXT_PUBLIC_ALS_REGION:-${region}}"
  # Live default is Maps V2. Named V1 maps are a runtime fallback on the live-incident
  # map only — do not bake v1 unless V2 is globally broken.
  export NEXT_PUBLIC_ALS_MAP_API_VERSION="${NEXT_PUBLIC_ALS_MAP_API_VERSION:-v2}"
  export NEXT_PUBLIC_ALS_MAP_STYLE="${NEXT_PUBLIC_ALS_MAP_STYLE:-Standard}"
  export NEXT_PUBLIC_ALS_PLACE_INDEX_NAME="${NEXT_PUBLIC_ALS_PLACE_INDEX_NAME:-rc-places-${stage}}"
  export NEXT_PUBLIC_ALS_ROUTE_CALCULATOR_NAME="${NEXT_PUBLIC_ALS_ROUTE_CALCULATOR_NAME:-rc-routes-${stage}}"
  export NEXT_PUBLIC_ALS_GEOFENCE_COLLECTION="${NEXT_PUBLIC_ALS_GEOFENCE_COLLECTION:-rc-geofences-${stage}}"
  export NEXT_PUBLIC_ALS_TRACKER_NAME="${NEXT_PUBLIC_ALS_TRACKER_NAME:-rc-tracker-${stage}}"

  # Always prefer CloudFormation AlsMapName* over stale shell exports (e.g. Esri rc-map-dev).
  local map_name map_dark
  map_name="$(aws cloudformation describe-stacks \
    --stack-name "${stack}" \
    --region "${region}" \
    --query "Stacks[0].Outputs[?OutputKey=='AlsMapName' || OutputKey=='MapName'].OutputValue | [0]" \
    --output text 2>/dev/null || true)"
  map_dark="$(aws cloudformation describe-stacks \
    --stack-name "${stack}" \
    --region "${region}" \
    --query "Stacks[0].Outputs[?OutputKey=='AlsMapNameDark' || OutputKey=='MapNameDark'].OutputValue | [0]" \
    --output text 2>/dev/null || true)"
  if [[ -n "${map_name}" && "${map_name}" != "None" ]]; then
    export NEXT_PUBLIC_ALS_MAP_NAME="${map_name}"
  fi
  if [[ -n "${map_dark}" && "${map_dark}" != "None" ]]; then
    export NEXT_PUBLIC_ALS_MAP_NAME_DARK="${map_dark}"
  fi

  # Drop legacy Esri names if they leaked in from an old shell/env bake.
  if [[ "${NEXT_PUBLIC_ALS_MAP_NAME:-}" == "rc-map-${stage}" ]]; then
    unset NEXT_PUBLIC_ALS_MAP_NAME
  fi
  if [[ "${NEXT_PUBLIC_ALS_MAP_NAME_DARK:-}" == "rc-map-dark-${stage}" ]]; then
    unset NEXT_PUBLIC_ALS_MAP_NAME_DARK
  fi

  # Fallback: Location stack creates HERE-named maps (see stack-app-sam-location.yaml).
  export NEXT_PUBLIC_ALS_MAP_NAME="${NEXT_PUBLIC_ALS_MAP_NAME:-rc-map-here-${stage}}"
  export NEXT_PUBLIC_ALS_MAP_NAME_DARK="${NEXT_PUBLIC_ALS_MAP_NAME_DARK:-rc-map-here-dark-${stage}}"

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
        # Persist so the next deploy does not depend on a CFN round-trip.
        aws ssm put-parameter \
          --name "${ssm_name}" \
          --type String \
          --value "${from_cf}" \
          --overwrite \
          --region "${region}" >/dev/null 2>&1 || true
      fi
    fi
  fi

  if [[ -n "${NEXT_PUBLIC_ALS_IDENTITY_POOL_ID:-}" && "${NEXT_PUBLIC_ALS_IDENTITY_POOL_ID}" != "None" ]]; then
    return 0
  fi
  return 1
}
