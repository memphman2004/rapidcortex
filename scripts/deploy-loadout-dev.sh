#!/usr/bin/env bash
# Surgical Loadout deploy (data + app) for dev — avoids full monolith deploy.sh.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

export AWS_PROFILE="${AWS_PROFILE:-rapid-cortex}"
export AWS_REGION="${AWS_REGION:-us-east-1}"
export SAM_BUILD_DIR="${SAM_BUILD_DIR:-$HOME/.rapid-cortex-sam-build/loadout}"
STAGE="${STAGE:-dev}"

source scripts/env-api-dev.sh 2>/dev/null || true

echo "── Loadout SSM (best-effort; CF params supply emails if SSM denied) ──"
bash scripts/setup-loadout-ssm.sh || echo "WARN: SSM put failed — continuing with template FromEmail/AdminEmail params"

echo "── Deploy Loadout data stack ──"
aws cloudformation deploy \
  --template-file infra/nested/stack-data-layer-loadout.yaml \
  --stack-name "rapid-cortex-loadout-data-${STAGE}" \
  --parameter-overrides "DeploymentStage=${STAGE}" DynamoTableNamePrefix=rapid-cortex \
  --capabilities CAPABILITY_IAM \
  --no-fail-on-empty-changeset \
  --region "${AWS_REGION}"

SUBS=$(aws cloudformation describe-stacks --stack-name "rapid-cortex-loadout-data-${STAGE}" \
  --query "Stacks[0].Outputs[?OutputKey=='LoadoutSubscriptionsTable'].OutputValue" --output text)
KEYS=$(aws cloudformation describe-stacks --stack-name "rapid-cortex-loadout-data-${STAGE}" \
  --query "Stacks[0].Outputs[?OutputKey=='LoadoutApiKeysTable'].OutputValue" --output text)
USAGE=$(aws cloudformation describe-stacks --stack-name "rapid-cortex-loadout-data-${STAGE}" \
  --query "Stacks[0].Outputs[?OutputKey=='LoadoutUsageTable'].OutputValue" --output text)
SWAP=$(aws cloudformation describe-stacks --stack-name "rapid-cortex-loadout-data-${STAGE}" \
  --query "Stacks[0].Outputs[?OutputKey=='LoadoutSwapHistoryTable'].OutputValue" --output text)
INV=$(aws cloudformation describe-stacks --stack-name "rapid-cortex-loadout-data-${STAGE}" \
  --query "Stacks[0].Outputs[?OutputKey=='LoadoutInvoicesTable'].OutputValue" --output text)

HTTP_API_ID=$(aws cloudformation describe-stacks --stack-name rapid-cortex-dev \
  --query "Stacks[0].Outputs[?OutputKey=='HttpApi3Id'].OutputValue" --output text)
POOL=$(aws cloudformation describe-stacks --stack-name rapid-cortex-dev \
  --query "Stacks[0].Outputs[?OutputKey=='UserPoolId'].OutputValue" --output text 2>/dev/null || echo "")
if [[ -z "$POOL" || "$POOL" == "None" ]]; then
  POOL=$(aws cloudformation describe-stack-resources --stack-name rapid-cortex-dev-AppSamStackV2 \
    --query "StackResourceSummaries[?LogicalResourceId=='UserPool'].PhysicalResourceId" --output text 2>/dev/null || true)
fi
# Fallback known pool from env scripts
POOL="${POOL:-us-east-1_0z6tA6WBs}"
CLIENT="${COGNITO_WEB_CLIENT_ID:-7moi6sgc2uf4o31omgvo77h3v5}"
ISSUER="https://cognito-idp.${AWS_REGION}.amazonaws.com/${POOL}"

echo "── Build lean Loadout bundle + deploy app SAM ──"
# Full sam build from /Volumes is too slow (CopySource). Bundle handlers with esbuild
# into ~/.rapid-cortex-sam-build/loadout-bundle and point CodeUri at an S3 zip.
LEAN_BUNDLE="${HOME}/.rapid-cortex-sam-build/loadout-bundle"
LEAN_TEMPLATE="${HOME}/.rapid-cortex-sam-build/stack-app-sam-loadout-s3.yaml"
ZIP="${HOME}/.rapid-cortex-sam-build/loadout-lambda.zip"
mkdir -p "${LEAN_BUNDLE}" "${SAM_BUILD_DIR}"

(cd packages/shared && npm run build)
npx esbuild \
  apps/api/src/loadout/authorizer.ts \
  apps/api/src/loadout/v1-stub.ts \
  apps/api/src/loadout/subscription-manager.ts \
  apps/api/src/loadout/invoice-generator.ts \
  --bundle --platform=node --target=node22 --format=cjs \
  --outdir="${LEAN_BUNDLE}" \
  '--external:@aws-sdk/*'

BUCKET=$(aws s3api list-buckets --query "Buckets[?contains(Name,'samclisourcebucket')].Name | [0]" --output text)
KEY="loadout/loadout-lambda-$(date -u +%Y%m%d%H%M%S).zip"
(cd "${LEAN_BUNDLE}" && rm -f "${ZIP}" && zip -qr "${ZIP}" . -x "*.DS_Store")
aws s3 cp "${ZIP}" "s3://${BUCKET}/${KEY}"

python3 - <<PY
from pathlib import Path
import re
src = Path("infra/nested/stack-app-sam-loadout.yaml").read_text()
# Point every Function CodeUri at the uploaded zip (keep Handler lines intact)
out = re.sub(
    r"(^[ ]{2,}CodeUri:\s*).*$",
    rf"\1s3://${BUCKET}/${KEY}",
    src,
    flags=re.M,
)
Path("${LEAN_TEMPLATE}").write_text(out)
print("Wrote ${LEAN_TEMPLATE}")
PY

sam deploy \
  --template-file "${LEAN_TEMPLATE}" \
  --stack-name "rapid-cortex-loadout-app-${STAGE}" \
  --capabilities CAPABILITY_IAM CAPABILITY_NAMED_IAM CAPABILITY_AUTO_EXPAND \
  --resolve-s3 \
  --no-confirm-changeset \
  --no-fail-on-empty-changeset \
  --region "${AWS_REGION}" \
  --parameter-overrides \
    "DeploymentStage=${STAGE}" \
    "HttpApiId=${HTTP_API_ID}" \
    "ImportedCognitoUserPoolId=${POOL}" \
    "ImportedCognitoWebClientId=${CLIENT}" \
    "ImportedCognitoIssuer=${ISSUER}" \
    "LoadoutSubscriptionsTable=${SUBS}" \
    "LoadoutApiKeysTable=${KEYS}" \
    "LoadoutUsageTable=${USAGE}" \
    "LoadoutSwapHistoryTable=${SWAP}" \
    "LoadoutInvoicesTable=${INV}" \
    "FromEmail=billing@rapidcortex.us" \
    "AdminEmail=ops@rapidcortex.us"

ENDPOINT=$(aws cloudformation describe-stacks --stack-name "rapid-cortex-loadout-app-${STAGE}" \
  --query "Stacks[0].Outputs[?OutputKey=='LoadoutApiEndpoint'].OutputValue" --output text)
echo "LoadoutApiEndpoint=${ENDPOINT}"
echo "DONE: rapid-cortex-loadout-app-${STAGE}"
