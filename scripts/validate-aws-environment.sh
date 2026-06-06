#!/usr/bin/env bash
set -euo pipefail

ENVIRONMENT="${1:-${DEPLOYMENT_STAGE:-development}}"
AWS_REGION="${AWS_REGION:-us-east-1}"
STAGE_HINT="${STAGE:-$ENVIRONMENT}"
REPORT_DIR="${REPORT_DIR:-artifacts/cjis-validation/${ENVIRONMENT}-$(date -u +%Y%m%dT%H%M%SZ)}"
AWS_PROFILE_ARG=()

if [[ -n "${AWS_PROFILE:-}" ]]; then
  AWS_PROFILE_ARG=(--profile "$AWS_PROFILE")
fi

echo "Running CJIS AWS environment validation"
echo "environment=${ENVIRONMENT} region=${AWS_REGION} stage_hint=${STAGE_HINT}"
echo "report_dir=${REPORT_DIR}"

python3 cjis_compliance_checker.py \
  --environment "${ENVIRONMENT}" \
  --region "${AWS_REGION}" \
  --stage-hint "${STAGE_HINT}" \
  --report-dir "${REPORT_DIR}" \
  --fail-on-error \
  ${AWS_PROFILE_ARG[@]+"${AWS_PROFILE_ARG[@]}"}

echo "Validation completed: ${REPORT_DIR}"
