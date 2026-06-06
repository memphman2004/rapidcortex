#!/usr/bin/env bash
set -euo pipefail
ENVIRONMENT="${1:-dev}"
AWS_REGION="${AWS_REGION:-${AWS_DEFAULT_REGION:-us-east-1}}"
PIPELINE_STACK="${WEB_PIPELINE_STACK_NAME:-rapid-cortex-web-pipeline-${ENVIRONMENT}}"
ZIP_PATH="${PACKAGE_WEB_SOURCE_OUT:-}"

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ZIP_PATH="${ZIP_PATH:-${ROOT}/web-source-${ENVIRONMENT}.zip}"

if [[ ! -f "${ZIP_PATH}" ]]; then
  echo "❌ ZIP not found: ${ZIP_PATH} (run scripts/package-web-source.sh first)" >&2
  exit 1
fi

echo "Uploading ${ZIP_PATH} to pipeline stack bucket (${PIPELINE_STACK})…"

SOURCE_BUCKET="$(
  aws cloudformation describe-stacks \
    --stack-name "${PIPELINE_STACK}" \
    --query 'Stacks[0].Outputs[?OutputKey==`SourceBucketName`].OutputValue' \
    --output text \
    --region "${AWS_REGION}" 2>/dev/null || true
)"

if [[ -z "${SOURCE_BUCKET}" || "${SOURCE_BUCKET}" == "None" ]]; then
  echo "❌ Source bucket not found. Deploy infra/web-pipeline-codebuild.yaml as stack ${PIPELINE_STACK}" >&2
  exit 1
fi

aws s3 cp "${ZIP_PATH}" "s3://${SOURCE_BUCKET}/web-source.zip" --region "${AWS_REGION}"
echo "✓ Uploaded s3://${SOURCE_BUCKET}/web-source.zip"
