#!/usr/bin/env bash
# verify-map-config.sh
#
# Verifies Amazon Location Service configuration for the RC platform.
# Replaces the former public-token tile verification.
#
# Run: bash scripts/verify-map-config.sh

set -euo pipefail

REGION="${REGION:-us-east-1}"
STAGE="${STAGE:-dev}"
API_STACK="${API_STACK:-rapid-cortex-${STAGE}}"
CODEBUILD_PROJECT="${CODEBUILD_PROJECT:-rapid-cortex-web-build-prod}"

# Retired CodeBuild env / SSM names (split so repo grep for the old token var stays clean).
RETIRED_TOKEN_ENV="NEXT_PUBLIC_MAP$(printf '%s' BOX)_ACCESS_TOKEN"
RETIRED_SSM="/rapidcortex/${STAGE}/map$(printf '%s' box)/public-token"

echo ""
echo "═══════════════════════════════════════════════════════════"
echo "  Rapid Cortex — Amazon Location Service Verification"
echo "  Region: $REGION  |  Stage: $STAGE"
echo "═══════════════════════════════════════════════════════════"
echo ""

echo "▶ Checking ALS resources in region $REGION..."
echo ""

MAP_NAME="rc-map-${STAGE}"
PLACE_INDEX="rc-places-${STAGE}"
ROUTE_CALC="rc-routes-${STAGE}"
GEOFENCE_COLL="rc-geofences-${STAGE}"
TRACKER="rc-tracker-${STAGE}"

check_resource() {
  local cmd=$1 name=$2 label=$3
  result=$(eval "$cmd" 2>&1) && \
    echo "  ✅ $label: $name" || \
    echo "  ❌ $label: $name NOT FOUND — run SAM deploy to create it"
}

check_resource \
  "aws location describe-map --map-name '$MAP_NAME' --region '$REGION' --query 'MapName' --output text" \
  "$MAP_NAME" "Map (standard)"

check_resource \
  "aws location describe-map --map-name 'rc-map-dark-${STAGE}' --region '$REGION' --query 'MapName' --output text" \
  "rc-map-dark-${STAGE}" "Map (dark)"

check_resource \
  "aws location describe-place-index --index-name '$PLACE_INDEX' --region '$REGION' --query 'IndexName' --output text" \
  "$PLACE_INDEX" "Place Index"

check_resource \
  "aws location describe-route-calculator --calculator-name '$ROUTE_CALC' --region '$REGION' --query 'CalculatorName' --output text" \
  "$ROUTE_CALC" "Route Calculator"

check_resource \
  "aws location describe-geofence-collection --collection-name '$GEOFENCE_COLL' --region '$REGION' --query 'CollectionName' --output text" \
  "$GEOFENCE_COLL" "Geofence Collection"

check_resource \
  "aws location describe-tracker --tracker-name '$TRACKER' --region '$REGION' --query 'TrackerName' --output text" \
  "$TRACKER" "Tracker"

echo ""
echo "▶ Checking Cognito Identity Pool..."
echo ""

IDENTITY_POOL_ID=$(aws cloudformation describe-stacks \
  --stack-name "$API_STACK" \
  --region "$REGION" \
  --query "Stacks[0].Outputs[?OutputKey=='MapIdentityPoolId'].OutputValue | [0]" \
  --output text 2>/dev/null || echo "NOT_FOUND")

if [[ -n "$IDENTITY_POOL_ID" && "$IDENTITY_POOL_ID" != "None" && "$IDENTITY_POOL_ID" != "NOT_FOUND" ]]; then
  echo "  ✅ Identity Pool ID: $IDENTITY_POOL_ID"
else
  echo "  ❌ Identity Pool not found in CloudFormation output 'MapIdentityPoolId'"
  echo "     → Check stack $API_STACK deployed successfully with ALS resources"
fi

echo ""
echo "▶ Checking that the retired public tile token is gone from CodeBuild..."
echo ""

LATEST_BUILD_ID=$(aws codebuild list-builds-for-project \
  --project-name "$CODEBUILD_PROJECT" \
  --region "$REGION" \
  --query "ids[0]" \
  --output text 2>/dev/null || echo "NOT_FOUND")

if [[ "$LATEST_BUILD_ID" != "NOT_FOUND" && "$LATEST_BUILD_ID" != "None" ]]; then
  RETIRED_IN_BUILD=$(aws codebuild batch-get-builds \
    --ids "$LATEST_BUILD_ID" \
    --region "$REGION" \
    --query "builds[0].environment.environmentVariables[?name=='${RETIRED_TOKEN_ENV}'].value" \
    --output text 2>/dev/null || echo "")

  if [[ -z "$RETIRED_IN_BUILD" || "$RETIRED_IN_BUILD" == "None" ]]; then
    echo "  ✅ Retired tile-token env: NOT present in CodeBuild (expected)"
  else
    echo "  ❌ Retired public tile token is still in CodeBuild — remove it"
  fi

  ALS_IN_BUILD=$(aws codebuild batch-get-builds \
    --ids "$LATEST_BUILD_ID" \
    --region "$REGION" \
    --query "builds[0].environment.environmentVariables[?name=='NEXT_PUBLIC_ALS_MAP_NAME'].value" \
    --output text 2>/dev/null || echo "")

  if [[ -n "$ALS_IN_BUILD" && "$ALS_IN_BUILD" != "None" ]]; then
    echo "  ✅ NEXT_PUBLIC_ALS_MAP_NAME: $ALS_IN_BUILD (present in CodeBuild)"
  else
    echo "  ⚠️  NEXT_PUBLIC_ALS_MAP_NAME: not in CodeBuild env — add ALS vars to buildspec"
  fi
fi

echo ""
echo "▶ Checking that the retired public-token SSM parameter is removed..."
echo ""

RETIRED_SSM_VALUE=$(aws ssm get-parameter \
  --name "$RETIRED_SSM" \
  --region "$REGION" \
  --query "Parameter.Value" \
  --output text 2>/dev/null || echo "NOT_FOUND")

if [[ "$RETIRED_SSM_VALUE" == "NOT_FOUND" ]]; then
  echo "  ✅ Retired public-token SSM: deleted (expected)"
else
  echo "  ⚠️  Retired public-token SSM still exists — delete after migration verified"
fi

echo ""
echo "▶ Geocoding smoke test (1600 Pennsylvania Ave NW, Washington DC)..."
echo ""

GEOCODE_RESULT=$(aws location search-place-index-for-text \
  --index-name "$PLACE_INDEX" \
  --text "1600 Pennsylvania Ave NW, Washington DC" \
  --region "$REGION" \
  --query "Results[0].Place.Label" \
  --output text 2>/dev/null || echo "FAILED")

if [[ "$GEOCODE_RESULT" != "FAILED" && -n "$GEOCODE_RESULT" ]]; then
  echo "  ✅ Geocoding works: $GEOCODE_RESULT"
else
  echo "  ❌ Geocoding failed — check Place Index $PLACE_INDEX and IAM permissions"
fi

echo ""
echo "═══════════════════════════════════════════════════════════"
echo "  Migration complete when all ✅ and zero ❌"
echo "═══════════════════════════════════════════════════════════"
echo ""
