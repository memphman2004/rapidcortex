#!/usr/bin/env bash
# Create HERE Explore / Contrast ALS maps for existing accounts.
#
# Amazon Location map Style is immutable. Live stacks already have Esri
# VectorEsriStreets / VectorEsriDarkGrayCanvas (rc-map-{stage}). This script
# adds rc-map-here-{stage} and rc-map-here-dark-{stage}, then grants the Cognito
# map identity roles tile access. Safe to re-run.
#
# Usage:
#   STAGE=dev REGION=us-east-1 bash scripts/create-als-ops-maps.sh
#
# Then point web env at the new names (print-stack-outputs-for-web.sh) and
# rebuild ECS. IAM in stack-app-sam-location.yaml is updated on the next deploy;
# this script patches the live identity-pool roles immediately.

set -euo pipefail

REGION="${AWS_REGION:-${AWS_DEFAULT_REGION:-us-east-1}}"
STAGE="${STAGE:-${DEPLOYMENT_STAGE:-dev}}"
# Live identity roles are ${AppName}-als-map-{unauth,auth}-${stage}
# (AppName is often rapid-cortex-dev, not the default "rapid-cortex").
PREFIX="${MANAGED_POLICY_NAME_PREFIX:-${APP_NAME:-rapid-cortex-dev}}"
LIGHT_NAME="rc-map-here-${STAGE}"
DARK_NAME="rc-map-here-dark-${STAGE}"
ESRI_LIGHT="rc-map-${STAGE}"
ESRI_DARK="rc-map-dark-${STAGE}"

ACCOUNT="$(aws sts get-caller-identity --query Account --output text --region "${REGION}")"
GEO_ARN="arn:aws:geo:${REGION}:${ACCOUNT}:map"

create_map() {
  local name="$1"
  local style="$2"
  local desc="$3"
  if aws location describe-map --map-name "${name}" --region "${REGION}" >/dev/null 2>&1; then
    echo "  exists  ${name}"
    return 0
  fi
  aws location create-map \
    --map-name "${name}" \
    --configuration "Style=${style}" \
    --description "${desc}" \
    --region "${REGION}" >/dev/null
  echo "  created ${name} (${style})"
}

echo "ALS ops maps  region=${REGION}  stage=${STAGE}  account=${ACCOUNT}"
create_map "${LIGHT_NAME}" "VectorHereExplore" "RC ops streets HERE Explore (${STAGE})"
create_map "${DARK_NAME}" "VectorHereContrast" "RC ops dark HERE Contrast (${STAGE})"

POLICY="$(cat <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "geo:GetMapTile",
        "geo:GetMapStyleDescriptor",
        "geo:GetMapSprites",
        "geo:GetMapGlyphs"
      ],
      "Resource": [
        "${GEO_ARN}/${ESRI_LIGHT}",
        "${GEO_ARN}/${ESRI_DARK}",
        "${GEO_ARN}/${LIGHT_NAME}",
        "${GEO_ARN}/${DARK_NAME}"
      ]
    }
  ]
}
EOF
)"

V2_POLICY="$(cat <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["geo-maps:GetTile"],
      "Resource": "arn:aws:geo-maps:${REGION}::provider/default"
    }
  ]
}
EOF
)"

for role in "${PREFIX}-als-map-unauth-${STAGE}" "${PREFIX}-als-map-auth-${STAGE}"; do
  if ! aws iam get-role --role-name "${role}" >/dev/null 2>&1; then
    echo "  skip IAM ${role} (role not found)"
    continue
  fi
  aws iam put-role-policy \
    --role-name "${role}" \
    --policy-name MapTilesOnly \
    --policy-document "${POLICY}" >/dev/null
  aws iam put-role-policy \
    --role-name "${role}" \
    --policy-name MapTilesV2 \
    --policy-document "${V2_POLICY}" >/dev/null
  echo "  IAM     ${role} MapTilesOnly (+ HERE maps) + MapTilesV2"
done

echo ""
echo "Web env:"
echo "  NEXT_PUBLIC_ALS_MAP_NAME=${LIGHT_NAME}"
echo "  NEXT_PUBLIC_ALS_MAP_NAME_DARK=${DARK_NAME}"
echo "  NEXT_PUBLIC_ALS_MAP_API_VERSION=v2"
echo "  NEXT_PUBLIC_ALS_MAP_STYLE=Standard"
echo "Rebuild the web ECS task after updating those vars. Unset API version to roll back to named HERE maps."
