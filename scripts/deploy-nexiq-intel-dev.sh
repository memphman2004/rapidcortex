#!/usr/bin/env bash
# Surgical NexiQ Intel deploy (data + app) for dev — avoids full monolith deploy.sh.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

export AWS_PROFILE="${AWS_PROFILE:-rapid-cortex}"
export AWS_REGION="${AWS_REGION:-us-east-1}"
export AWS_SDK_LOAD_CONFIG=1
unset HTTP_PROXY HTTPS_PROXY http_proxy https_proxy ALL_PROXY all_proxy || true
STAGE="${STAGE:-dev}"
APP_NAME="${APP_NAME:-rapid-cortex}"
BUNDLE="${HOME}/.rapid-cortex-sam-build/nexiq-intel-bundle"
ZIP="${HOME}/.rapid-cortex-sam-build/nexiq-intel-lambda.zip"
TEMPLATE_S3="${HOME}/.rapid-cortex-sam-build/stack-app-sam-nexiq-intel-s3.yaml"

echo "── Deploy NexiQ Intel data stack ──"
aws cloudformation deploy \
  --template-file infra/nested/stack-data-layer-nexiq-intel.yaml \
  --stack-name "rapid-cortex-nexiq-intel-data-${STAGE}" \
  --parameter-overrides \
    "DeploymentStage=${STAGE}" \
    "DynamoTableNamePrefix=rapid-cortex" \
    "AppName=${APP_NAME}" \
  --capabilities CAPABILITY_IAM \
  --no-fail-on-empty-changeset \
  --region "${AWS_REGION}"

out() {
  aws cloudformation describe-stacks --stack-name "rapid-cortex-nexiq-intel-data-${STAGE}" \
    --query "Stacks[0].Outputs[?OutputKey=='$1'].OutputValue" --output text
}

SOURCES=$(out NexiQIntelSourcesTable)
RUNS=$(out NexiQIntelSourceRunsTable)
DOCS=$(out NexiQIntelDocumentsTable)
SIGNALS=$(out NexiQIntelSignalsTable)
GAPS=$(out NexiQIntelGapsTable)
BENCH=$(out NexiQIntelBenchmarksTable)
COV=$(out NexiQIntelCoverageTable)
BUCKET=$(out NexiQIntelRawArtifactsBucketName)
COLL_URL=$(out NexiQIntelCollectionQueueUrl)
COLL_ARN=$(out NexiQIntelCollectionQueueArn)
PROC_URL=$(out NexiQIntelProcessingQueueUrl)
PROC_ARN=$(out NexiQIntelProcessingQueueArn)

HTTP_API_ID=$(aws cloudformation describe-stacks --stack-name rapid-cortex-dev \
  --query "Stacks[0].Outputs[?OutputKey=='HttpApi3Id'].OutputValue" --output text)
LEADS=$(aws cloudformation describe-stacks --stack-name rapid-cortex-dev \
  --query "Stacks[0].Outputs[?OutputKey=='SalesLeadsTable'].OutputValue" --output text 2>/dev/null || true)
if [[ -z "$LEADS" || "$LEADS" == "None" ]]; then
  LEADS="rapid-cortex-sales-leads-${STAGE}"
fi

AUDIT=$(aws cloudformation describe-stacks --stack-name rapid-cortex-dev \
  --query "Stacks[0].Outputs[?OutputKey=='AuditTable'].OutputValue" --output text 2>/dev/null || true)
if [[ -z "$AUDIT" || "$AUDIT" == "None" ]]; then
  AUDIT="rapid-cortex-audit-${STAGE}"
fi
POOL=$(aws cloudformation describe-stacks --stack-name rapid-cortex-dev \
  --query "Stacks[0].Outputs[?OutputKey=='UserPoolId'].OutputValue" --output text)
CLIENT=$(aws cloudformation describe-stacks --stack-name rapid-cortex-dev \
  --query "Stacks[0].Outputs[?OutputKey=='UserPoolClientId'].OutputValue" --output text)
ISSUER=$(aws cloudformation describe-stacks --stack-name rapid-cortex-dev \
  --query "Stacks[0].Outputs[?OutputKey=='CognitoIssuer'].OutputValue" --output text)

echo "HttpApi3Id=${HTTP_API_ID}"
echo "SalesLeadsTable=${LEADS}"
echo "AuditTable=${AUDIT}"

echo "── Build shared + esbuild NexiQ Intel handlers ──"
(cd packages/shared && npm run build)
rm -rf "${BUNDLE}"
mkdir -p "${BUNDLE}/dist/nexiq-intel"
for name in intel-collector intel-processor intel-api; do
  mkdir -p "${BUNDLE}/dist/nexiq-intel/${name}"
  npx esbuild "apps/api/src/nexiq-intel/${name}/index.ts" \
    --bundle --platform=node --target=node22 --format=cjs \
    --outfile="${BUNDLE}/dist/nexiq-intel/${name}/index.js" \
    '--external:@aws-sdk/*'
done
ls -lh "${BUNDLE}/dist/nexiq-intel"/*/index.js

SAM_BUCKET=$(aws s3api list-buckets --query "Buckets[?contains(Name,'samclisourcebucket')].Name | [0]" --output text)
KEY="nexiq-intel/nexiq-intel-lambda-$(date -u +%Y%m%d%H%M%S).zip"
(cd "${BUNDLE}" && rm -f "${ZIP}" && zip -qr "${ZIP}" . -x "*.DS_Store")
aws s3 cp "${ZIP}" "s3://${SAM_BUCKET}/${KEY}"

python3 - <<PY
from pathlib import Path
import re
src = Path("infra/nested/stack-app-sam-nexiq-intel.yaml").read_text()
out = re.sub(
    r"(^[ ]{2,}CodeUri:\s*).*$",
    rf"\1s3://${SAM_BUCKET}/${KEY}",
    src,
    flags=re.M,
)
Path("${TEMPLATE_S3}").write_text(out)
print("Wrote ${TEMPLATE_S3}")
for line in out.splitlines():
    if "CodeUri" in line or line.strip().startswith("Handler:"):
        print(line)
PY

echo "── Deploy NexiQ Intel app SAM ──"
sam deploy \
  --template-file "${TEMPLATE_S3}" \
  --stack-name "rapid-cortex-nexiq-intel-app-${STAGE}" \
  --capabilities CAPABILITY_IAM CAPABILITY_NAMED_IAM CAPABILITY_AUTO_EXPAND \
  --resolve-s3 \
  --no-confirm-changeset \
  --no-fail-on-empty-changeset \
  --region "${AWS_REGION}" \
  --parameter-overrides \
    "AppName=${APP_NAME}" \
    "DeploymentStage=${STAGE}" \
    "HttpApiId=${HTTP_API_ID}" \
    "EnableNexiQIntel=true" \
    "NexiQIntelSourcesTable=${SOURCES}" \
    "NexiQIntelSourceRunsTable=${RUNS}" \
    "NexiQIntelDocumentsTable=${DOCS}" \
    "NexiQIntelSignalsTable=${SIGNALS}" \
    "NexiQIntelGapsTable=${GAPS}" \
    "NexiQIntelBenchmarksTable=${BENCH}" \
    "NexiQIntelCoverageTable=${COV}" \
    "NexiQIntelRawArtifactsBucket=${BUCKET}" \
    "NexiQIntelCollectionQueueUrl=${COLL_URL}" \
    "NexiQIntelCollectionQueueArn=${COLL_ARN}" \
    "NexiQIntelProcessingQueueUrl=${PROC_URL}" \
    "NexiQIntelProcessingQueueArn=${PROC_ARN}" \
    "LeadsTableName=${LEADS}" \
    "AuditTable=${AUDIT}" \
    "CognitoUserPoolId=${POOL}" \
    "CognitoClientId=${CLIENT}" \
    "CognitoIssuer=${ISSUER}" \
    "RapidIqRawSignalsQueueUrl=https://sqs.${AWS_REGION}.amazonaws.com/158961537080/rapid-cortex-${STAGE}-rapid-iq-pipeline-raw-signals-${STAGE}.fifo" \
    "RapidIqRawSignalsQueueArn=arn:aws:sqs:${AWS_REGION}:158961537080:rapid-cortex-${STAGE}-rapid-iq-pipeline-raw-signals-${STAGE}.fifo" \
    "RapidIqPipelineSignalsTable=rapid-cortex-rapid-iq-pipeline-signals-${STAGE}"

echo "DONE: rapid-cortex-nexiq-intel-app-${STAGE}"
aws cloudformation describe-stacks --stack-name "rapid-cortex-nexiq-intel-app-${STAGE}" \
  --query "Stacks[0].Outputs" --output table
