# Source before deploying API stacks (dev): ./scripts/deploy.sh dev or ./scripts/deploy2.sh dev
# Usage: source scripts/env-api-dev.sh
#
# Clear overrides from other env scripts (e.g. scripts/env-web-ssr-prod.sh sets STACK_NAME for ECS/CloudFront).
# Otherwise `deploy.sh dev` would update the wrong CloudFormation stack.
unset STACK_NAME
export APP_NAME="rapid-cortex"

export INCLUDE_DATA_LAYER_NESTED_STACK=true
export FLAT_DATA_LAYER_BILLING_PAYMENT_INSTRUCTIONS_SECRET_ARN="arn:aws:secretsmanager:us-east-1:158961537080:secret:rapid-cortex/billing/payment-instructions-cQc3vU"
export FLAT_DATA_LAYER_BILLING_SES_CREDENTIALS_SECRET_ARN="arn:aws:secretsmanager:us-east-1:158961537080:secret:rapid-cortex/billing/ses-credentials-kWOL2Y"
export ENABLE_CLOUD_TRAIL=false
export SAM_BUILD_DIR="$HOME/.rapid-cortex-sam-build"
# Recovery (optional): SAM_BUILD_USE_CACHE=0 SAM_DISABLE_ROLLBACK=1 for first deploy after Cognito/AppSamStackV2 recovery.

# Active Cognito pool (AppSamStackV2) — auto-fetched from rapid-cortex-dev outputs
export COGNITO_USER_POOL_ID="$(aws cloudformation describe-stacks --stack-name rapid-cortex-dev --region us-east-1 --query 'Stacks[0].Outputs[?OutputKey==`UserPoolId`].OutputValue' --output text)"
export COGNITO_CLIENT_ID="$(aws cloudformation describe-stacks --stack-name rapid-cortex-dev --region us-east-1 --query 'Stacks[0].Outputs[?OutputKey==`UserPoolClientId`].OutputValue' --output text)"
export COGNITO_NATIVE_CLIENT_ID="$(aws cloudformation describe-stacks --stack-name rapid-cortex-dev --region us-east-1 --query 'Stacks[0].Outputs[?OutputKey==`NativeUserPoolClientId`].OutputValue' --output text)"
export COGNITO_ISSUER="$(aws cloudformation describe-stacks --stack-name rapid-cortex-dev --region us-east-1 --query 'Stacks[0].Outputs[?OutputKey==`CognitoIssuer`].OutputValue' --output text)"
# Stack 2 nested imports (deploy2.sh)
export IMPORTED_COGNITO_USER_POOL_ID="${COGNITO_USER_POOL_ID}"
export IMPORTED_COGNITO_WEB_CLIENT_ID="${COGNITO_CLIENT_ID}"
export IMPORTED_COGNITO_NATIVE_CLIENT_ID="${COGNITO_NATIVE_CLIENT_ID}"
export IMPORTED_COGNITO_ISSUER="${COGNITO_ISSUER}"

# Live video (KVS WebRTC) — AppSam2Stack in rapid-cortex-dev (stack-app-sam-2.yaml).
export ENABLE_LIVE_VIDEO_RESOURCES=true
export LIVE_VIDEO_PUBLIC_BASE_URL="https://www.rapidcortex.us"
export KVS_SIGNALING_CHANNEL_NAME=rc-live-dev
export KVS_VIDEO_STREAM_NAME=rc-lvsv-dev
export KVS_STREAM_RETENTION_HOURS=24
export KVS_ENABLE_STORAGE=true
export AWS_REGION=us-east-1

# CAD API poller: skip outbound vendor HTTP in dev (`CadApiPollerFunction`).
export CAD_POLLER_MOCK=1

# Optional SAM / template parameters for CAD write-back (see infra/template.yaml + nested/stack-app-sam.yaml):
#   CadWritebackEnabled=true|false  CadWritebackRequiresApproval=true|false
# Globals expose CAD_WRITEBACK_* to Lambdas; `CadWritebackHttpFunction` owns POST /api/cad/writeback/{incidentId}
# and /api/admin/cad-writeback-approvals* routes.
#
# DEV PILOT ONLY (after Stack 2 deploy + smoke tests):
#   export CAD_WRITEBACK_ENABLED="true"
#   export CAD_WRITEBACK_REQUIRES_APPROVAL="true"
#
# DO NOT set CAD_WRITEBACK_ENABLED=true for prod|staging|pilot until all go/no-go checks pass and the
# pilot agency has signed the CAD writeback addendum (deploy.sh blocks prod if set anyway).

# Hospital module: HospitalRoutingHttpFunction + HospitalPortalHttpFunction in stack-app-sam-2.yaml.
# Redeploy stack 2 after hospital API/SAM changes: ./scripts/deploy2.sh dev
export SAM_BUILD_DIR="$HOME/.rapid-cortex-sam-build"
