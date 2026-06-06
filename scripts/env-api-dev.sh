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

# HttpApi CORS + Cognito Hosted UI URLs — include app subdomain (SSR) alongside marketing apex/www.
export HTTP_API_CORS_ORIGINS="https://www.rapidcortex.us,https://rapidcortex.us,https://app.rapidcortex.us,https://report.rapidcortex.us"
export COGNITO_CALLBACK_URLS="https://app.rapidcortex.us/api/auth/callback,https://app.rapidcortex.us/auth/return-to-app,https://www.rapidcortex.us/api/auth/callback,https://www.rapidcortex.us/auth/return-to-app,https://rapidcortex.us/api/auth/callback,https://rapidcortex.us/auth/return-to-app"
export COGNITO_LOGOUT_URLS="https://app.rapidcortex.us,https://www.rapidcortex.us,https://rapidcortex.us"
export COGNITO_NATIVE_CALLBACK_URLS="rapidcortex://oauth/callback,rapidcortex-desktop://oauth/callback,rapidcortex-ios://oauth/callback,rapidcortex-windows://oauth/callback,https://app.rapidcortex.us/auth/return-to-app,https://www.rapidcortex.us/auth/return-to-app,https://rapidcortex.us/auth/return-to-app"

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

# Silent Text + Pinpoint (LiveLocation) — both Lambdas live in stack-app-sam.yaml (Stack 1) as of
# 2026-05-25 so they ride the api.rapidcortex.us custom domain.
#
# DEV / test-agency rollout (2026-05-25):
#  - Silent Text: ON in dev so QA can exercise the dispatcher flow end-to-end.
#  - Pinpoint:    OFF until Silent Text smoke tests pass (sequenced rollout per pilot plan).
# IMPORTANT: until the Twilio secret below is rotated off PLACEHOLDER values, every Silent Text
# `createSession` will return `lastError = CONFIG_ERROR` from the SMS provider factory and audit
# `silent_text.sms.failed`. Verify with:
#   aws secretsmanager get-secret-value --secret-id rapid-cortex/incident-media/twilio --region us-east-1
export ENABLE_SILENT_TEXT=true
export ENABLE_PINPOINT=false
export APP_PUBLIC_BASE_URL="https://www.rapidcortex.us"

# Shared Twilio secret (used by Incident Media + Silent Text + Pinpoint SMS paths). The runtime
# `loadTwilioSecret` (apps/api/src/services/sms/twilioSmsProvider.ts) accepts both the legacy
# {accountSid, authToken, fromNumber} shape and the API-key {accountSid, apiKeySid, apiKeySecret,
# messagingServiceSid} shape. Rotate without redeploying:
#   aws secretsmanager put-secret-value --secret-id rapid-cortex/incident-media/twilio \
#     --secret-string '{...}' --region us-east-1
export INCIDENT_MEDIA_TWILIO_SECRET_ARN="arn:aws:secretsmanager:us-east-1:158961537080:secret:rapid-cortex/incident-media/twilio-az6LeK"

# Ring Connect — live partner credentials (rapid-cortex/connect/ring-credentials)
export RING_CREDENTIALS_SECRET_ARN_OVERRIDE="arn:aws:secretsmanager:us-east-1:158961537080:secret:rapid-cortex/connect/ring-credentials-D3f1sN"
export ENABLE_CONNECT_RING=true
export RING_PARTNERSHIP_ENABLED=true

# ---------------------------------------------------------------------------------------------
# Optional secret ARNs — created 2026-05-25 with PLACEHOLDER values, pinned here so the SAM
# parameters resolve once you flip them on. Each remains commented until the feature behind it
# is ready to deploy; uncomment + rotate the secret value, then ./scripts/deploy.sh dev.
#
# Rotate any secret in place (no Lambda redeploy needed — Secrets Manager is read at runtime):
#   aws secretsmanager put-secret-value --secret-id <name> --secret-string '<new-value>' --region us-east-1
# ---------------------------------------------------------------------------------------------

# AI providers — JSON {"apiKey":"sk-..."} or plain string. Bedrock-Anthropic via IAM is the
# default path, so these only matter if you want OpenAI / direct-Anthropic as primary/fallback.
# PR 1 (STT chain `azure → openai → aws`) enables OPENAI_API_KEY_SECRET_ARN as the secondary STT
# provider (OpenAiWhisperSttProvider). The same secret is consumed by Whisper STT today; any
# direct OpenAI text/completion path can read the same ARN.
export OPENAI_API_KEY_SECRET_ARN="arn:aws:secretsmanager:us-east-1:158961537080:secret:rapid-cortex/ai/openai-kqZQ3D"
# export ANTHROPIC_API_KEY_SECRET_ARN="arn:aws:secretsmanager:us-east-1:158961537080:secret:rapid-cortex/ai/anthropic-fHk4y2"

# Multilingual — Translate + TTS (Google) and STT/Translator (Azure). The same Azure ARN is
# referenced from both AzureSpeechKey and AzureTranslationKey SAM params (one rotation surface);
# resolvePlainOrSecretArn picks the right JSON field via the `preferredField` option introduced
# in PR 1 (apps/api/src/lib/runtimeSecrets.ts).
# export GOOGLE_APPLICATION_CREDENTIALS_SECRET_ARN="arn:aws:secretsmanager:us-east-1:158961537080:secret:rapid-cortex/multilingual/google-service-account-xgBdWL"
export AZURE_SPEECH_KEY_SECRET_ARN="arn:aws:secretsmanager:us-east-1:158961537080:secret:rapid-cortex/multilingual/azure-keys-H28Jkj"
export AZURE_TRANSLATION_KEY_SECRET_ARN="arn:aws:secretsmanager:us-east-1:158961537080:secret:rapid-cortex/multilingual/azure-keys-H28Jkj"

# External API (/external/v1) — JWT signing + at-rest webhook secret encryption (scrypt
# passphrase, NOT a KMS key). Required before exposing the External API to integrators.
# export EXTERNAL_API_JWT_SECRET_ARN="arn:aws:secretsmanager:us-east-1:158961537080:secret:rapid-cortex/external-api/jwt-eplYZu"
# export EXTERNAL_API_ENCRYPTION_KEY_ARN="arn:aws:secretsmanager:us-east-1:158961537080:secret:rapid-cortex/external-api/encryption-qVsfCT"

# Maps (Mapbox) is NOT a Secrets Manager entry — it's NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN baked
# into apps/web at build time and protected via Mapbox URL-referrer allowlist. Set it in the
# web ECS task env (scripts/env-web-*.sh) when needed.

# --- Web feature flags (NEXT_PUBLIC_*) — readable by apps/web build invoked alongside API deploys ---
# SLA Threshold / Call Backlog dashboards on dispatcher + supervisor views. Off by default in dev;
# enable per pilot when SLA targets and ingestion are wired (apps/web/lib/runtime-flags.ts::isSlaBacklogEnabled).
# export NEXT_PUBLIC_ENABLE_SLA_BACKLOG=1
