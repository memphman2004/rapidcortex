#!/usr/bin/env bash
set -euo pipefail
ENVIRONMENT="${1:-dev}"
AWS_REGION="${AWS_REGION:-${AWS_DEFAULT_REGION:-us-east-1}}"
PIPELINE_STACK="${API_PIPELINE_STACK_NAME:-rapid-cortex-api-pipeline-${ENVIRONMENT}}"
ZIP_PATH="${PACKAGE_API_SOURCE_OUT:-}"

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ZIP_PATH="${ZIP_PATH:-${ROOT}/api-source-${ENVIRONMENT}.zip}"

if [[ ! -f "${ZIP_PATH}" ]]; then
  echo "❌ ZIP not found: ${ZIP_PATH} (run scripts/package-api-source.sh first)" >&2
  exit 1
fi

echo "Uploading ${ZIP_PATH} to pipeline stack bucket (${PIPELINE_STACK})…"

SOURCE_BUCKET="$(
  aws cloudformation describe-stacks \
    --stack-name "${PIPELINE_STACK}" \
    --query 'Stacks[0].Outputs[?OutputKey==`SourceBucketName`].OutputValue' \
    --output text \
    --region "${AWS_REGION}"
)" || true

if [[ -z "${SOURCE_BUCKET}" || "${SOURCE_BUCKET}" == "None" ]]; then
  SOURCE_BUCKET="${API_PIPELINE_SOURCE_BUCKET:-}"
fi

if [[ -z "${SOURCE_BUCKET}" || "${SOURCE_BUCKET}" == "None" ]]; then
  echo "❌ Source bucket not found for stack ${PIPELINE_STACK}." >&2
  echo "   Check: aws cloudformation describe-stacks --stack-name ${PIPELINE_STACK} --region ${AWS_REGION}" >&2
  echo "   Or set API_PIPELINE_SOURCE_BUCKET=… and re-run." >&2
  exit 1
fi

aws s3 cp "${ZIP_PATH}" "s3://${SOURCE_BUCKET}/api-source.zip" --region "${AWS_REGION}"
echo "✓ Uploaded s3://${SOURCE_BUCKET}/api-source.zip"
