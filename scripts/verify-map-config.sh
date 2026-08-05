#!/usr/bin/env bash
# verify-map-config.sh
#
# Checks the live prod deployment for:
#   1. Whether NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN was baked into the running image
#   2. Whether the API SAM stack has EnablePinpoint=true
#   3. Which web env flags are set in the running ECS task
#
# Run: bash scripts/verify-map-config.sh

set -euo pipefail

REGION="${REGION:-us-east-1}"
ECS_CLUSTER="${ECS_CLUSTER:-rapid-cortex-v2-web-prod}"
ECS_SERVICE="${ECS_SERVICE:-rapid-cortex-v2-web-prod}"
API_STACK="${API_STACK:-rapid-cortex-dev}"
CODEBUILD_PROJECT="${CODEBUILD_PROJECT:-rapid-cortex-web-build-prod}"

echo ""
echo "═══════════════════════════════════════════════════════"
echo "  Rapid Cortex — Map Configuration Verification"
echo "  Region: $REGION"
echo "═══════════════════════════════════════════════════════"
echo ""

# ─── 1. Check the most recent CodeBuild build for the Mapbox token ───────────

echo "▶ Checking most recent CodeBuild build for map-related env vars..."
echo ""

LATEST_BUILD_ID=$(aws codebuild list-builds-for-project \
  --project-name "$CODEBUILD_PROJECT" \
  --region "$REGION" \
  --query "ids[0]" \
  --output text 2>/dev/null | head -1 | tr -d '\r' || echo "NOT_FOUND")

if [[ "$LATEST_BUILD_ID" == "NOT_FOUND" || "$LATEST_BUILD_ID" == "None" ]]; then
  echo "  ⚠️  CodeBuild project '$CODEBUILD_PROJECT' not found or no builds. Adjust CODEBUILD_PROJECT env."
else
  echo "  Most recent build: $LATEST_BUILD_ID"

  BUILD_STATUS=$(aws codebuild batch-get-builds \
    --ids "$LATEST_BUILD_ID" \
    --region "$REGION" \
    --query "builds[0].buildStatus" \
    --output text 2>/dev/null || echo "UNKNOWN")

  BUILD_END=$(aws codebuild batch-get-builds \
    --ids "$LATEST_BUILD_ID" \
    --region "$REGION" \
    --query "builds[0].endTime" \
    --output text 2>/dev/null || echo "unknown")

  echo "  Status: $BUILD_STATUS  |  Completed: $BUILD_END"

  MAPBOX_IN_BUILD=$(aws codebuild batch-get-builds \
    --ids "$LATEST_BUILD_ID" \
    --region "$REGION" \
    --query "builds[0].environment.environmentVariables[?name=='NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN'].value" \
    --output text 2>/dev/null || echo "")

  PINPOINT_IN_BUILD=$(aws codebuild batch-get-builds \
    --ids "$LATEST_BUILD_ID" \
    --region "$REGION" \
    --query "builds[0].environment.environmentVariables[?name=='NEXT_PUBLIC_ENABLE_PINPOINT'].value" \
    --output text 2>/dev/null || echo "")

  if [[ -n "$MAPBOX_IN_BUILD" && "$MAPBOX_IN_BUILD" != "None" ]]; then
    MASKED="${MAPBOX_IN_BUILD:0:8}...${MAPBOX_IN_BUILD: -4}"
    echo "  ✅ NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN  = $MASKED  (baked into this build)"
  else
    echo "  ❌ NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN  = NOT SET in this build → maps will render blank"
  fi

  if [[ -n "$PINPOINT_IN_BUILD" && "$PINPOINT_IN_BUILD" != "None" ]]; then
    echo "  ✅ NEXT_PUBLIC_ENABLE_PINPOINT      = $PINPOINT_IN_BUILD"
  else
    echo "  ⚠️  NEXT_PUBLIC_ENABLE_PINPOINT      = NOT SET in this build (may be set in buildspec)"
  fi
fi

echo ""

# ─── 2. Check running ECS task definition environment ────────────────────────

echo "▶ Checking running ECS task definition for map flags..."
echo ""

TASK_ARN=$(aws ecs list-tasks \
  --cluster "$ECS_CLUSTER" \
  --service-name "$ECS_SERVICE" \
  --region "$REGION" \
  --query "taskArns[0]" \
  --output text 2>/dev/null || echo "NONE")

if [[ "$TASK_ARN" == "NONE" || "$TASK_ARN" == "None" ]]; then
  echo "  ⚠️  No running tasks found in $ECS_CLUSTER / $ECS_SERVICE"
else
  TASK_DEF=$(aws ecs describe-tasks \
    --cluster "$ECS_CLUSTER" \
    --tasks "$TASK_ARN" \
    --region "$REGION" \
    --query "tasks[0].taskDefinitionArn" \
    --output text)

  echo "  Task definition: $TASK_DEF"

  MAP_FLAGS=$(aws ecs describe-task-definition \
    --task-definition "$TASK_DEF" \
    --region "$REGION" \
    --query "taskDefinition.containerDefinitions[0].environment[?starts_with(name, 'NEXT_PUBLIC_ENABLE') || name=='NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN'].[name,value]" \
    --output text 2>/dev/null || echo "")

  if [[ -n "$MAP_FLAGS" ]]; then
    echo "  Runtime env vars with NEXT_PUBLIC_* (map-related):"
    while IFS=$'\t' read -r name value; do
      if [[ "$name" == "NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN" ]]; then
        echo "    $name = ${value:0:8}...${value: -4}"
      else
        echo "    $name = $value"
      fi
    done <<< "$MAP_FLAGS"
  else
    echo "  ℹ️  NEXT_PUBLIC_* vars not found in runtime task env — expected if baked at build time only."
  fi
fi

echo ""

# ─── 3. Check API SAM stack for EnablePinpoint ────────────────────────────────

echo "▶ Checking API SAM stack EnablePinpoint parameter..."
echo ""

ENABLE_PINPOINT=$(aws cloudformation describe-stacks \
  --stack-name "$API_STACK" \
  --region "$REGION" \
  --query "Stacks[0].Parameters[?ParameterKey=='EnablePinpoint'].ParameterValue" \
  --output text 2>/dev/null || echo "NOT_FOUND")

if [[ "$ENABLE_PINPOINT" == "NOT_FOUND" ]]; then
  echo "  ⚠️  Stack '$API_STACK' not found. Adjust API_STACK env."
elif [[ "$ENABLE_PINPOINT" == "true" || "$ENABLE_PINPOINT" == "True" ]]; then
  echo "  ✅ EnablePinpoint = true  (Pinpoint API routes are live)"
elif [[ "$ENABLE_PINPOINT" == "None" || -z "$ENABLE_PINPOINT" ]]; then
  echo "  ⚠️  EnablePinpoint = not set (SAM default: false) → Pinpoint API will reject requests"
else
  echo "  ❌ EnablePinpoint = $ENABLE_PINPOINT → Pinpoint API inactive"
fi

echo ""

# ─── 4. Check env-web-ssr-prod.sh for the Mapbox export ─────────────────────

echo "▶ Checking env-web-ssr-prod.sh for Mapbox token..."
echo ""

PROD_ENV="scripts/env-web-ssr-prod.sh"
if [[ -f "$PROD_ENV" ]]; then
  if grep -q "NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN" "$PROD_ENV"; then
    MAPBOX_LINE=$(grep "NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN" "$PROD_ENV" | head -1)
    echo "  ✅ Found in $PROD_ENV:"
    echo "     $MAPBOX_LINE"
    if grep -q 'NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN="${NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN:-}"' "$PROD_ENV"; then
      echo "  ℹ️  Token uses shell fallback — must export NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN before sourcing"
    fi
  else
    echo "  ❌ NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN is NOT in $PROD_ENV"
    echo "     → Add it before the next web deploy (see fix below)"
  fi

  if grep -q "NEXT_PUBLIC_ENABLE_PINPOINT" "$PROD_ENV"; then
    PINPOINT_LINE=$(grep "NEXT_PUBLIC_ENABLE_PINPOINT" "$PROD_ENV" | head -1)
    echo "  ✅ NEXT_PUBLIC_ENABLE_PINPOINT found:"
    echo "     $PINPOINT_LINE"
  else
    echo "  ⚠️  NEXT_PUBLIC_ENABLE_PINPOINT is NOT in $PROD_ENV"
    echo "     → Add it for Pinpoint UI to render"
  fi

  if grep -q "NEXT_PUBLIC_MAPBOX_STYLE_URL" "$PROD_ENV"; then
    STYLE_LINE=$(grep "NEXT_PUBLIC_MAPBOX_STYLE_URL" "$PROD_ENV" | head -1)
    echo "  ✅ NEXT_PUBLIC_MAPBOX_STYLE_URL found:"
    echo "     $STYLE_LINE"
  else
    echo "  ⚠️  NEXT_PUBLIC_MAPBOX_STYLE_URL is NOT in $PROD_ENV"
    echo "     → Add: export NEXT_PUBLIC_MAPBOX_STYLE_URL=\"mapbox://styles/memphman2004/cmr3afd69002401qq1uywfk5p\""
  fi
else
  echo "  ⚠️  $PROD_ENV not found — run from repo root"
fi

echo ""
echo "═══════════════════════════════════════════════════════"
echo "  Summary / Fix"
echo "═══════════════════════════════════════════════════════"
echo ""
echo "  To activate maps in prod, three things must be true:"
echo ""
echo "  [1] NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN in env-web-ssr-prod.sh (or exported before source)"
echo "      → Get a public token (restricted to app.rapidcortex.us) from account.mapbox.com"
echo "      → Add: export NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN=\"pk.eyJ1...\""
echo "      → Then redeploy web (see fix script)"
echo ""
echo "  [2] NEXT_PUBLIC_ENABLE_PINPOINT=1 in env-web-ssr-prod.sh"
echo "      → Add: export NEXT_PUBLIC_ENABLE_PINPOINT=1"
echo ""
echo "  [3] EnablePinpoint=true in API SAM stack"
echo "      → Add EnablePinpoint=true to your deploy.sh param override for prod"
echo "      → Then: ENABLE_PINPOINT=true ./scripts/deploy.sh dev"
echo ""
echo "  One-liner once Mapbox token is set:"
echo "    export NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN=\"pk.eyJ1...\""
echo "    source scripts/env-web-ssr-prod.sh"
echo "    ./scripts/deploy-web-no-docker.sh prod"
echo ""
