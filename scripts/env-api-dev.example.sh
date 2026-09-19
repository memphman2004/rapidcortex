#!/usr/bin/env bash
# Copy to scripts/env-api-dev.sh (gitignored) and fill secrets/ARNs locally.
# Live production is DeploymentStage=dev (rapid-cortex-dev / app.rapidcortex.us).
#
#   source scripts/env-api-dev.sh
#   bash scripts/deploy.sh dev
#
# This example documents SOC 2 lock-in. deploy.sh sources
# scripts/lib/soc2-live-production-overrides.sh for STAGE=dev and will:
#   - force DDB_ENABLE_PITR=true
#   - keep ENABLE_CLOUD_TRAIL=false (Option B trail rapid-cortex-cloudtrail-prod)
#   - reject CAD_WRITEBACK_ENABLED=true
#
# Do not set ENABLE_CLOUD_TRAIL=true — SAM would create an Object Lock COMPLIANCE
# bucket rapid-cortex-cloudtrail-logs-dev-<account> and a second trail.

export I_UNDERSTAND_DEV_IS_PROD=1
export APP_NAME="rapid-cortex"
export AWS_PROFILE="${AWS_PROFILE:-rapid-cortex}"
export AWS_REGION="${AWS_REGION:-us-east-1}"
export AWS_DEFAULT_REGION="${AWS_DEFAULT_REGION:-${AWS_REGION}}"

# PITR on live (also forced by soc2-live-production-overrides.sh)
export DDB_ENABLE_PITR=true

# Option B CloudTrail — do not create SAM trail on this stack
export ENABLE_CLOUD_TRAIL=false

# CAD write-back fail-closed
export CAD_WRITEBACK_ENABLED=false
unset NEXT_PUBLIC_ENABLE_CAD_WRITEBACK

# Regional WAF ACL is optional (HTTP API cannot associate WAFv2).
# Live edge WAF is CloudFront via scripts/deploy-api-edge.sh.
# export ENABLE_API_WAF=false

echo "env-api-dev.example.sh is a template — copy to env-api-dev.sh and add account-specific ARNs."
