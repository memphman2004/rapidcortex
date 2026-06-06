#!/usr/bin/env bash
set -euo pipefail

# Deploys AWS-native SSR web runtime (infra only — see infra/web-ssr-infra-template.yaml):
# ECR + ECS cluster + task definition + ALB + CloudFront + WAF + Route53. ECS **service** is created/updated by
# scripts/deploy-web-no-docker.sh (Step 6) after this stack succeeds.
#
# Main API/Cognito stack outputs (HttpApiUrl, UserPoolId, etc.) come from the SAM deploy via
# `scripts/deploy.sh` (nested `infra/template.yaml`). Pass those values here as COGNITO_* and API_BASE_URL.
#
# Required env:
#   VPC_ID
#   PRIVATE_SUBNET_IDS (comma-separated)
#   PUBLIC_SUBNET_IDS (comma-separated)
#   ROUTE53_HOSTED_ZONE_ID
#   CLOUDFRONT_CERT_ARN (us-east-1)
#   ALB_CERT_ARN (same region as stack)
#   API_BASE_URL
#   API_BASE_URL_2 or API_UPSTREAM_BASE_2 (optional — stack-2 API Gateway for comms + contact-sales)
#   COGNITO_USER_POOL_ID
#   COGNITO_CLIENT_ID
#
# Optional env:
#   STAGE (default prod)
#   APP_NAME (default rapid-cortex)
#   ROOT_DOMAIN (default rapidcortex.us)
#   STACK_NAME (default ${APP_NAME}-web-ssr-${STAGE})
#   COGNITO_REGION (default AWS_REGION)
#   ECR_REPOSITORY_OVERRIDE (e.g. rapid-cortex-web-ssr) — use existing ECR, skip create
#   ECS_ASSIGN_PUBLIC_IP (ENABLED|DISABLED, default ENABLED for default VPC)
#   ATTACH_CLOUDFRONT_ALIASES (true|false, default true) — apex + www CloudFront aliases. Set false when marketing
#     owns apex/www; use ATTACH_APP_SUBDOMAIN_ALIAS for app.${ROOT_DOMAIN} instead.
#   ATTACH_APP_SUBDOMAIN_ALIAS (true|false, default true) — app.${ROOT_DOMAIN} CloudFront alias (e.g. app.rapidcortex.us).
#   CREATE_ROUTE53_ALIAS_RECORDS (true|false, default true) — when Attach… is true: create apex/www A/AAAA in Route53.
#     Set false if those names already exist until you delete them or repoint DNS manually.
#   CREATE_ROUTE53_APP_SUBDOMAIN_RECORDS (true|false, default true) — app subdomain A/AAAA in Route53.
#   PUBLIC_SITE_URL (optional) — NEXT_PUBLIC_SITE_URL on ECS (default template: https://app.rapidcortex.us).
#   ALLOWED_ORIGINS (optional) — APP_ALLOWED_ORIGINS on ECS (comma-separated https origins).

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

STAGE="${STAGE:-prod}"
APP_NAME="${APP_NAME:-rapid-cortex}"
ROOT_DOMAIN="${ROOT_DOMAIN:-rapidcortex.us}"
STACK_NAME="${STACK_NAME:-${APP_NAME}-web-ssr-${STAGE}}"

: "${VPC_ID:?VPC_ID is required}"
: "${PRIVATE_SUBNET_IDS:?PRIVATE_SUBNET_IDS is required}"
: "${PUBLIC_SUBNET_IDS:?PUBLIC_SUBNET_IDS is required}"
: "${ROUTE53_HOSTED_ZONE_ID:?ROUTE53_HOSTED_ZONE_ID is required}"
: "${CLOUDFRONT_CERT_ARN:?CLOUDFRONT_CERT_ARN is required}"
: "${ALB_CERT_ARN:?ALB_CERT_ARN is required}"
: "${API_BASE_URL:?API_BASE_URL is required}"
: "${COGNITO_USER_POOL_ID:?COGNITO_USER_POOL_ID is required}"
: "${COGNITO_CLIENT_ID:?COGNITO_CLIENT_ID is required}"

AWS_REGION="${AWS_REGION:-us-east-1}"
COGNITO_REGION="${COGNITO_REGION:-$AWS_REGION}"
ECS_ASSIGN_PUBLIC_IP="${ECS_ASSIGN_PUBLIC_IP:-ENABLED}"
ECR_REPOSITORY_OVERRIDE="${ECR_REPOSITORY_OVERRIDE:-}"
ATTACH_CLOUDFRONT_ALIASES="${ATTACH_CLOUDFRONT_ALIASES:-true}"
ATTACH_APP_SUBDOMAIN_ALIAS="${ATTACH_APP_SUBDOMAIN_ALIAS:-true}"
ATTACH_REPORT_SUBDOMAIN_ALIAS="${ATTACH_REPORT_SUBDOMAIN_ALIAS:-false}"
CREATE_ROUTE53_ALIAS_RECORDS="${CREATE_ROUTE53_ALIAS_RECORDS:-true}"
CREATE_ROUTE53_APP_SUBDOMAIN_RECORDS="${CREATE_ROUTE53_APP_SUBDOMAIN_RECORDS:-true}"
CREATE_ROUTE53_REPORT_SUBDOMAIN_RECORDS="${CREATE_ROUTE53_REPORT_SUBDOMAIN_RECORDS:-false}"

# Build overrides as an array so `set -u` never expands an empty `${PARAM_EXTRA[@]}`.
DEPLOY_OVERRIDES=(
  "AppName=${APP_NAME}"
  "DeploymentStage=${STAGE}"
  "VpcId=${VPC_ID}"
  "PrivateSubnetIds=${PRIVATE_SUBNET_IDS}"
  "PublicSubnetIds=${PUBLIC_SUBNET_IDS}"
  "RootDomainName=${ROOT_DOMAIN}"
  "AttachCloudFrontAliases=${ATTACH_CLOUDFRONT_ALIASES}"
  "AttachAppSubdomainAlias=${ATTACH_APP_SUBDOMAIN_ALIAS}"
  "AttachReportSubdomainAlias=${ATTACH_REPORT_SUBDOMAIN_ALIAS}"
  "CreateRoute53AliasRecords=${CREATE_ROUTE53_ALIAS_RECORDS}"
  "CreateRoute53AppSubdomainRecords=${CREATE_ROUTE53_APP_SUBDOMAIN_RECORDS}"
  "CreateRoute53ReportSubdomainRecords=${CREATE_ROUTE53_REPORT_SUBDOMAIN_RECORDS}"
  "Route53HostedZoneId=${ROUTE53_HOSTED_ZONE_ID}"
  "ViewerCertificateArn=${CLOUDFRONT_CERT_ARN}"
  "OriginAlbCertificateArn=${ALB_CERT_ARN}"
  "ApiBaseUrl=${API_BASE_URL}"
  "CognitoUserPoolId=${COGNITO_USER_POOL_ID}"
  "CognitoClientId=${COGNITO_CLIENT_ID}"
  "CognitoRegion=${COGNITO_REGION}"
  "EcsAssignPublicIp=${ECS_ASSIGN_PUBLIC_IP}"
)
if [[ -n "$ECR_REPOSITORY_OVERRIDE" ]]; then
  DEPLOY_OVERRIDES+=( "EcrRepositoryOverride=${ECR_REPOSITORY_OVERRIDE}" )
fi
if [[ -n "${COGNITO_DOMAIN:-}" ]]; then
  DEPLOY_OVERRIDES+=( "CognitoHostedUiDomain=${COGNITO_DOMAIN}" )
fi
API_BASE_URL_2="${API_BASE_URL_2:-${API_UPSTREAM_BASE_2:-}}"
if [[ -n "${API_BASE_URL_2}" ]]; then
  DEPLOY_OVERRIDES+=( "ApiBaseUrl2=${API_BASE_URL_2}" )
fi
if [[ -n "${PUBLIC_SITE_URL:-}" ]]; then
  DEPLOY_OVERRIDES+=( "PublicSiteUrl=${PUBLIC_SITE_URL}" )
fi
if [[ -n "${NEXT_PUBLIC_MARKETING_SITE_URL:-}" ]]; then
  DEPLOY_OVERRIDES+=( "MarketingSiteUrl=${NEXT_PUBLIC_MARKETING_SITE_URL}" )
fi
if [[ -n "${ALLOWED_ORIGINS:-}" ]]; then
  DEPLOY_OVERRIDES+=( "AllowedOrigins=${ALLOWED_ORIGINS}" )
fi
if [[ -n "${NEXT_PUBLIC_REPORT_ORIGIN:-}" ]]; then
  DEPLOY_OVERRIDES+=( "ReportSiteUrl=${NEXT_PUBLIC_REPORT_ORIGIN}" )
fi

aws cloudformation deploy \
  --region "$AWS_REGION" \
  --template-file "$ROOT/infra/web-ssr-infra-template.yaml" \
  --stack-name "$STACK_NAME" \
  --capabilities CAPABILITY_NAMED_IAM \
  --no-fail-on-empty-changeset \
  --parameter-overrides "${DEPLOY_OVERRIDES[@]}"

echo ""
echo "SSR web stack outputs:"
aws cloudformation describe-stacks \
  --region "$AWS_REGION" \
  --stack-name "$STACK_NAME" \
  --query "Stacks[0].Outputs" \
  --output table
