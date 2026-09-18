#!/usr/bin/env bash
# Copy to scripts/env-api-dev.sh (gitignored) and fill local ARNs/credentials.
#
# Live production is DeploymentStage=dev (rapid-cortex-dev / https://app.rapidcortex.us).
# Do not rename that stack. Source this file, then: bash scripts/deploy.sh dev
#
# SOC 2 Type II: CloudTrail, DynamoDB PITR, and API WAF must be explicit `true`
# overrides. scripts/deploy.sh also forces them via
# scripts/lib/soc2-live-production-overrides.sh so a stale local env file cannot
# turn the controls off on the next SAM deploy.

export I_UNDERSTAND_DEV_IS_PROD=1
export APP_NAME="rapid-cortex"
export AWS_PROFILE="${AWS_PROFILE:-rapid-cortex}"
export AWS_REGION="${AWS_REGION:-us-east-1}"
export AWS_DEFAULT_REGION="${AWS_DEFAULT_REGION:-${AWS_REGION}}"

# --- SOC 2 observation-period controls (do not rely on DeploymentStage conditions) ---
export ENABLE_CLOUD_TRAIL=true
export DDB_ENABLE_PITR=true
export ENABLE_API_WAF=true
export ACM_EXPIRY_CERTIFICATE_ARN="${ACM_EXPIRY_CERTIFICATE_ARN:-arn:aws:acm:us-east-1:158961537080:certificate/cc0f7fc4-d4ca-4b1a-8ff6-e0676d872fa5}"

# CAD write-back stays fail-closed until pilot go/no-go + signed addendum.
export CAD_WRITEBACK_ENABLED=false

echo "✅ Live API env ready — ENABLE_CLOUD_TRAIL=${ENABLE_CLOUD_TRAIL} DDB_ENABLE_PITR=${DDB_ENABLE_PITR} ENABLE_API_WAF=${ENABLE_API_WAF}"
