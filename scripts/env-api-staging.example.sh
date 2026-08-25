#!/usr/bin/env bash
# Source before deploying the engineering API stack:
#   source scripts/env-api-staging.sh
#   bash scripts/ensure-stage-orphan-resources.sh staging
#   bash scripts/deploy.sh staging --changeset-only
#
# Staging is the engineering environment. Live production is DeploymentStage=dev
# (rapid-cortex-dev / https://app.rapidcortex.us). Do not source this file and then
# run deploy.sh dev.
#
# Copy to scripts/env-api-staging.sh (gitignored) and fill any local overrides.

# Clear overrides from other env scripts (env-web-ssr-prod.sh sets STACK_NAME for ECS).
unset STACK_NAME
export APP_NAME="rapid-cortex"
export AWS_PROFILE="${AWS_PROFILE:-rapid-cortex}"
export AWS_REGION="${AWS_REGION:-us-east-1}"
export AWS_DEFAULT_REGION="${AWS_DEFAULT_REGION:-${AWS_REGION}}"

_ENV_API_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]:-${(%):-%x}}")/.." && pwd)"
# shellcheck source=scripts/lib/rapid-cortex-aws.sh
source "${_ENV_API_ROOT}/scripts/lib/rapid-cortex-aws.sh"
if ! rapid_cortex_assert_aws_account; then
  echo "Fix: export AWS_PROFILE=rapid-cortex (account ${RAPID_CORTEX_AWS_ACCOUNT_ID})" >&2
  return 1 2>/dev/null || exit 1
fi
unset _ENV_API_ROOT

export INCLUDE_DATA_LAYER_NESTED_STACK=true
export INCLUDE_APP_SAM_ALARMS_NESTED_STACK=true
export ENABLE_CLOUD_TRAIL=false
export MANAGE_API_DOMAIN_DNS=false
unset ROUTE53_HOSTED_ZONE_ID
unset API_DOMAIN_CERT_ARN
export API_SUBDOMAIN_PREFIX="${API_SUBDOMAIN_PREFIX:-api-staging}"
export COGNITO_DOMAIN_PREFIX="${COGNITO_DOMAIN_PREFIX:-rapidcortex-stg-158961537080}"

# Billing secrets already created by the failed Aug 2026 staging DataLayer (Retain).
export EXISTING_BILLING_PAYMENT_INSTRUCTIONS_SECRET_ARN="${EXISTING_BILLING_PAYMENT_INSTRUCTIONS_SECRET_ARN:-arn:aws:secretsmanager:us-east-1:158961537080:secret:rapid-cortex/staging/billing/payment-instructions-09Zlcz}"
export EXISTING_BILLING_SES_CREDENTIALS_SECRET_ARN="${EXISTING_BILLING_SES_CREDENTIALS_SECRET_ARN:-arn:aws:secretsmanager:us-east-1:158961537080:secret:rapid-cortex/staging/billing/ses-credentials-0yIlMB}"

if [[ -d '/Volumes/Mac Mini' ]]; then
  export SAM_BUILD_DIR="${SAM_BUILD_DIR:-/Volumes/Mac Mini/.rapid-cortex-sam-build-staging}"
else
  export SAM_BUILD_DIR="${SAM_BUILD_DIR:-${HOME}/.rapid-cortex-sam-build-staging}"
fi
export SAM_PARALLEL="${SAM_PARALLEL:-1}"

# Engineering web host + local Next against staging API. Never list app.rapidcortex.us here.
export HTTP_API_CORS_ORIGINS="https://app-staging.rapidcortex.us,http://localhost:3000"
export COGNITO_CALLBACK_URLS="https://app-staging.rapidcortex.us/api/auth/callback,https://app-staging.rapidcortex.us/auth/return-to-app,http://localhost:3000/api/auth/callback,http://localhost:3000/auth/return-to-app"
export COGNITO_LOGOUT_URLS="https://app-staging.rapidcortex.us,http://localhost:3000"
export COGNITO_NATIVE_CALLBACK_URLS="rapidcortex://oauth/callback,rapidcortex-desktop://oauth/callback,rapidcortex-ios://oauth/callback,rapidcortex-windows://oauth/callback,https://app-staging.rapidcortex.us/auth/return-to-app"

export ENABLE_LIVE_VIDEO_RESOURCES=true
export LIVE_VIDEO_PUBLIC_BASE_URL="https://app-staging.rapidcortex.us"
export KVS_SIGNALING_CHANNEL_NAME=rc-live-staging
export KVS_VIDEO_STREAM_NAME=rc-lvsv-staging
export KVS_STREAM_RETENTION_HOURS=24
export KVS_ENABLE_STORAGE=true

export CAD_POLLER_MOCK=1
export CAD_WRITEBACK_ENABLED=false
unset NEXT_PUBLIC_ENABLE_CAD_WRITEBACK
unset CAD_WRITEBACK_REQUIRES_APPROVAL

export ENABLE_SILENT_TEXT=true
export VOICE_BRIDGE_ENABLED=true
export ENABLE_PINPOINT=true
export APP_PUBLIC_BASE_URL="https://app-staging.rapidcortex.us"
export APP_BASE_URL="https://app-staging.rapidcortex.us"

# Shared account secrets (same ARNs as live). Isolation is Dynamo/S3/Cognito, not these keys.
export INCIDENT_MEDIA_TWILIO_SECRET_ARN="${INCIDENT_MEDIA_TWILIO_SECRET_ARN:-arn:aws:secretsmanager:us-east-1:158961537080:secret:rapid-cortex/incident-media/twilio-az6LeK}"
export RING_CREDENTIALS_SECRET_ARN_OVERRIDE="${RING_CREDENTIALS_SECRET_ARN_OVERRIDE:-arn:aws:secretsmanager:us-east-1:158961537080:secret:rapid-cortex/connect/ring-credentials-D3f1sN}"
export OPENAI_API_KEY_SECRET_ARN="${OPENAI_API_KEY_SECRET_ARN:-arn:aws:secretsmanager:us-east-1:158961537080:secret:rapid-cortex/ai/openai-kqZQ3D}"
export ANTHROPIC_API_KEY_SECRET_ARN="${ANTHROPIC_API_KEY_SECRET_ARN:-arn:aws:secretsmanager:us-east-1:158961537080:secret:rapid-cortex/ai/anthropic-fHk4y2}"
export AZURE_SPEECH_KEY_SECRET_ARN="${AZURE_SPEECH_KEY_SECRET_ARN:-arn:aws:secretsmanager:us-east-1:158961537080:secret:rapid-cortex/multilingual/azure-keys-H28Jkj}"
export AZURE_TRANSLATION_KEY_SECRET_ARN="${AZURE_TRANSLATION_KEY_SECRET_ARN:-arn:aws:secretsmanager:us-east-1:158961537080:secret:rapid-cortex/multilingual/azure-keys-H28Jkj}"

export ENABLE_CONNECT_RING=true
export ENABLE_CONNECT_NEST=true
export RING_PARTNERSHIP_ENABLED=true
# Staging Ring/Nest callbacks — web host until AppSam4 execute-api URLs exist. Never use live stack 4.
export RING_REDIRECT_URI="${RING_REDIRECT_URI:-https://app-staging.rapidcortex.us/api/integrations/ring/callback}"
export RING_ACCOUNT_LINK_URL="${RING_ACCOUNT_LINK_URL:-https://app-staging.rapidcortex.us/connect/ring/link}"
export NEST_REDIRECT_URI="${NEST_REDIRECT_URI:-https://app-staging.rapidcortex.us/api/cameras/providers/nest/callback}"

export ENABLE_ESCALATION=true
export ENABLE_RMS=true
export ENABLE_QA_SCORING=true
export ENABLE_QA_SCORE_AFTER_ANALYSIS=true
export ENABLE_INCIDENT_MEDIA=true
export ENABLE_SOP_PROTOCOL_AI=true
export ENABLE_NON_EMERGENCY_TRIAGE=true
export ENABLE_NG911_ASSIST=true
export NG911_DIVERSION_MOCK_SMS=true
export ENABLE_FIELD_CONFIDENCE=true
export CONFIDENCE_SCORING_MOCK=true
export ENABLE_CAD_CONFIDENCE_GATE=true
export ENABLE_DISPATCHER_WELLNESS=true
export ENABLE_CALLER_CARD=true
export ENABLE_CROSS_JURISDICTION_SHARES=true
export ENABLE_LIVE_VIDEO=true
export ENABLE_EMERGENCY_CONNECT=true
export ENABLE_HOSPITAL_ROUTING=true
export ENABLE_SURGE=true
export ENABLE_RAPID_IQ=true
export NEXT_PUBLIC_ENABLE_RAPID_IQ="${NEXT_PUBLIC_ENABLE_RAPID_IQ:-1}"
export ENABLE_RAPID_IQ_PIPELINE=true
export ENABLE_CONFERENCES=true
export RAPID_IQ_COLLECTORS_MOCK="${RAPID_IQ_COLLECTORS_MOCK:-1}"
export RAPID_IQ_INGEST_SINCE="${RAPID_IQ_INGEST_SINCE:-2026-01-01}"
export ENABLE_RCS=true

export RAPID_IQ_OPPORTUNITIES_TABLE="rapid-cortex-rapid-iq-opportunities-staging"
export RAPID_IQ_SIGNALS_TABLE="rapid-cortex-rapid-iq-signals-staging"
export RAPID_IQ_CONTACTS_TABLE="rapid-cortex-rapid-iq-contacts-staging"
export RAPID_IQ_SOURCES_TABLE="rapid-cortex-rapid-iq-sources-staging"
export RAPID_IQ_JURISDICTIONS_TABLE="rapid-cortex-rapid-iq-jurisdictions-staging"
export RAPID_IQ_STATE_COVERAGE_TABLE="rapid-cortex-rapid-iq-state-coverage-staging"
export CONFERENCES_TABLE="rapid-cortex-conferences-staging"
export CONTACT_COMPANIES_TABLE="rapid-cortex-contact-companies-staging"
export CONTACT_PERSONS_TABLE="rapid-cortex-contact-persons-staging"
export RCS_CALLS_TABLE="rapid-cortex-rcs-calls-staging"
export RCS_UNITS_TABLE="rapid-cortex-rcs-units-staging"
export RCS_ESCALATION_TABLE="rapid-cortex-rcs-escalation-staging"
export QR_NFC_CODES_TABLE="rapid-cortex-qr-nfc-codes-staging"

# Cognito — populated after the staging API stack is CREATE/UPDATE_COMPLETE.
if aws cloudformation describe-stacks --stack-name rapid-cortex-staging --region us-east-1 >/dev/null 2>&1; then
  export COGNITO_USER_POOL_ID="$(aws cloudformation describe-stacks --stack-name rapid-cortex-staging --region us-east-1 --query 'Stacks[0].Outputs[?OutputKey==`UserPoolId`].OutputValue' --output text 2>/dev/null || true)"
  export COGNITO_CLIENT_ID="$(aws cloudformation describe-stacks --stack-name rapid-cortex-staging --region us-east-1 --query 'Stacks[0].Outputs[?OutputKey==`UserPoolClientId`].OutputValue' --output text 2>/dev/null || true)"
  export COGNITO_NATIVE_CLIENT_ID="$(aws cloudformation describe-stacks --stack-name rapid-cortex-staging --region us-east-1 --query 'Stacks[0].Outputs[?OutputKey==`NativeUserPoolClientId`].OutputValue' --output text 2>/dev/null || true)"
  export COGNITO_ISSUER="$(aws cloudformation describe-stacks --stack-name rapid-cortex-staging --region us-east-1 --query 'Stacks[0].Outputs[?OutputKey==`CognitoIssuer`].OutputValue' --output text 2>/dev/null || true)"
  export IMPORTED_COGNITO_USER_POOL_ID="${COGNITO_USER_POOL_ID:-}"
  export IMPORTED_COGNITO_WEB_CLIENT_ID="${COGNITO_CLIENT_ID:-}"
  export IMPORTED_COGNITO_NATIVE_CLIENT_ID="${COGNITO_NATIVE_CLIENT_ID:-}"
  export IMPORTED_COGNITO_ISSUER="${COGNITO_ISSUER:-}"
else
  echo "NOTE: rapid-cortex-staging is not complete yet — Cognito exports will populate after the first successful API deploy." >&2
fi

echo "✅ Staging API env ready — MANAGE_API_DOMAIN_DNS=${MANAGE_API_DOMAIN_DNS} API_SUBDOMAIN_PREFIX=${API_SUBDOMAIN_PREFIX} CAD_WRITEBACK_ENABLED=${CAD_WRITEBACK_ENABLED}"
