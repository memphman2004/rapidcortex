#!/usr/bin/env bash
# SOC 2 Type II — explicit CloudFormation parameter overrides for live production.
#
# Live customer traffic is DeploymentStage=dev (stack rapid-cortex-dev / app.rapidcortex.us).
# Do NOT rename that stack. Do NOT rely on EnablePilotGradeBackups stage conditions:
# `auto` PITR is off on nested AppSam stacks when stage is `dev`.
#
# Source from scripts/deploy.sh (and deploy2.sh) when STAGE=dev, after env-api-dev.sh.
# Break-glass: SOC2_ALLOW_DISABLE_LIVE_CONTROLS=1 honors caller exports (incident only).
#
# shellcheck disable=SC2034

if [[ "${SOC2_ALLOW_DISABLE_LIVE_CONTROLS:-}" == "1" ]]; then
  echo "WARN: SOC2_ALLOW_DISABLE_LIVE_CONTROLS=1 — not forcing CloudTrail/PITR/API WAF on." >&2
  return 0 2>/dev/null || exit 0
fi

export ENABLE_CLOUD_TRAIL=true
export DDB_ENABLE_PITR=true
export ENABLE_API_WAF=true
export ACM_EXPIRY_CERTIFICATE_ARN="${ACM_EXPIRY_CERTIFICATE_ARN:-arn:aws:acm:us-east-1:158961537080:certificate/cc0f7fc4-d4ca-4b1a-8ff6-e0676d872fa5}"

echo "SOC 2 live overrides: EnableCloudTrail=true DynamoPointInTimeRecovery=true EnableApiWaf=true"
