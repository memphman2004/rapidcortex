#!/usr/bin/env bash
set -euo pipefail
# Deploy using operator-oriented env var names. Reads the same variables as
# scripts/deploy.sh (see header there), with ENV_NAME as the deployment stage.
#
# Core:
#   AWS_PROFILE, AWS_REGION — standard AWS CLI; not passed into the template.
#   APP_NAME=rapid-cortex  →  SAM parameter AppName (S3, Cognito, SNS, Dynamo prefix slug, etc.)
#   ENV_NAME=dev|staging|prod|pilot  →  DeploymentStage (stack name default: ${APP_NAME}-${ENV_NAME})
#
# Optional AWS resource overrides are forwarded when set: DDB_*, COGNITO_*, SNS_*, SES_*.
# If both IAM_ROLE_NAME and IAM_POLICY_NAME are set, this script runs scripts/deploy-iam.sh first.

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

STAGE="${ENV_NAME:-${1:-}}"
if [[ -z "$STAGE" ]]; then
  echo "Set ENV_NAME=dev|staging|prod|pilot, or pass the stage as the first argument." >&2
  exit 1
fi
case "$STAGE" in dev|staging|prod|pilot) ;; *)
  echo "ENV_NAME (or arg) must be one of: dev, staging, prod, pilot" >&2
  exit 1
  ;;
esac

if [[ -n "${IAM_ROLE_NAME:-}" || -n "${IAM_POLICY_NAME:-}" ]]; then
  if [[ -z "${IAM_ROLE_NAME:-}" || -z "${IAM_POLICY_NAME:-}" ]]; then
    echo "Set both IAM_ROLE_NAME and IAM_POLICY_NAME to run IAM deployment." >&2
    exit 1
  fi
  "$ROOT/scripts/deploy-iam.sh"
fi

exec "$ROOT/scripts/deploy.sh" "$STAGE"
