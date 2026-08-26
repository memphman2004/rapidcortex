#!/usr/bin/env bash
# SSR engineering stack — app-staging.rapidcortex.us (never app.rapidcortex.us).
# Copy to scripts/env-web-ssr-staging.sh (gitignored). Fill Cognito + API URLs from
#   ./scripts/print-stack-outputs-for-web.sh staging us-east-1
# after rapid-cortex-staging is CREATE_COMPLETE.
#
# ACM: the live cert does not include app-staging. Run:
#   bash scripts/ensure-staging-acm-cert.sh
# then paste CLOUDFRONT_CERT_ARN / ALB_CERT_ARN below.

unset STACK_NAME
export AWS_PROFILE="${AWS_PROFILE:-rapid-cortex}"
export AWS_REGION="${AWS_REGION:-us-east-1}"
export AWS_DEFAULT_REGION="${AWS_DEFAULT_REGION:-$AWS_REGION}"
export STAGE="staging"
export APP_NAME="rapid-cortex-stg"
export STACK_NAME="rapid-cortex-web-ssr-staging"
export ROOT_DOMAIN="rapidcortex.us"
export APP_SUBDOMAIN_PREFIX="app-staging"

export ATTACH_CLOUDFRONT_ALIASES="false"
export ATTACH_APP_SUBDOMAIN_ALIAS="true"
export CREATE_ROUTE53_ALIAS_RECORDS="false"
export CREATE_ROUTE53_APP_SUBDOMAIN_RECORDS="true"
export ATTACH_REPORT_SUBDOMAIN_ALIAS="false"
export CREATE_ROUTE53_REPORT_SUBDOMAIN_RECORDS="false"

export PUBLIC_SITE_URL="https://app-staging.rapidcortex.us"
export NEXT_PUBLIC_SITE_URL="https://app-staging.rapidcortex.us"
export NEXT_PUBLIC_APP_ORIGIN="https://app-staging.rapidcortex.us"
export NEXT_PUBLIC_MARKETING_SITE_URL="https://www.rapidcortex.us"
export ALLOWED_ORIGINS="https://app-staging.rapidcortex.us"
export NEXT_PUBLIC_REPORT_ORIGIN="https://report.rapidcortex.us"
export APP_URL="https://app-staging.rapidcortex.us"
export NEXT_PUBLIC_APP_ENV="staging"
export NEXT_PUBLIC_AUTH_PROXY="1"
export NEXT_PUBLIC_ENABLE_CAD_WRITEBACK=""
unset NEXT_PUBLIC_ENABLE_CAD_WRITEBACK

# Reuse account VPC/subnets from live SSR; unique ECS/ALB/CloudFront names via APP_NAME + STAGE.
export VPC_ID="${VPC_ID:-vpc-06df7e1782e17fb47}"
export PRIVATE_SUBNET_IDS="${PRIVATE_SUBNET_IDS:-subnet-001dc25e11291c319,subnet-0e392dcc44bd9d002,subnet-0cad1f86057aff07c,subnet-00aa8f92b3997d267,subnet-0745130c0e8d413d0,subnet-0e86087edb1bbdf68}"
export PUBLIC_SUBNET_IDS="${PUBLIC_SUBNET_IDS:-subnet-001dc25e11291c319,subnet-0e392dcc44bd9d002,subnet-0cad1f86057aff07c,subnet-00aa8f92b3997d267,subnet-0745130c0e8d413d0,subnet-0e86087edb1bbdf68}"
export ROUTE53_HOSTED_ZONE_ID="${ROUTE53_HOSTED_ZONE_ID:-Z03951423J46LZ4YUDS6A}"

# ACM issued 2026-08-23 for app-staging.rapidcortex.us (scripts/ensure-staging-acm-cert.sh).
export CLOUDFRONT_CERT_ARN="${CLOUDFRONT_CERT_ARN:-arn:aws:acm:us-east-1:158961537080:certificate/e90921db-152e-418f-afef-981b8cf1b417}"
export ALB_CERT_ARN="${ALB_CERT_ARN:-${CLOUDFRONT_CERT_ARN}}"

# Do not reuse rapid-cortex-web-prod — that :latest tag is live.
unset ECR_REPOSITORY_OVERRIDE

# Fill from staging SAM outputs after API deploy. Leave empty until then.
export API_BASE_URL="${API_BASE_URL:-}"
export API_UPSTREAM_BASE="${API_UPSTREAM_BASE:-}"
export API_UPSTREAM_BASE_2="${API_UPSTREAM_BASE_2:-}"
export API_UPSTREAM_BASE_3="${API_UPSTREAM_BASE_3:-}"
export API_UPSTREAM_BASE_4="${API_UPSTREAM_BASE_4:-}"
export API_UPSTREAM_BASE_5="${API_UPSTREAM_BASE_5:-}"
export NEXT_PUBLIC_API_BASE="${API_UPSTREAM_BASE}"
export NEXT_PUBLIC_API_BASE_2="${API_UPSTREAM_BASE_2}"
export NEXT_PUBLIC_API_BASE_3="${API_UPSTREAM_BASE_3}"
export NEXT_PUBLIC_API_BASE_4="${API_UPSTREAM_BASE_4}"
export NEXT_PUBLIC_API_BASE_5="${API_UPSTREAM_BASE_5}"

export COGNITO_USER_POOL_ID="${COGNITO_USER_POOL_ID:-}"
export COGNITO_CLIENT_ID="${COGNITO_CLIENT_ID:-}"
export COGNITO_NATIVE_CLIENT_ID="${COGNITO_NATIVE_CLIENT_ID:-}"
export COGNITO_ISSUER="${COGNITO_ISSUER:-}"
export NEXT_PUBLIC_COGNITO_USER_POOL_ID="${COGNITO_USER_POOL_ID:-}"
export NEXT_PUBLIC_COGNITO_CLIENT_ID="${COGNITO_CLIENT_ID:-}"
export NEXT_PUBLIC_COGNITO_NATIVE_CLIENT_ID="${COGNITO_NATIVE_CLIENT_ID:-}"
export NEXT_PUBLIC_COGNITO_REGION="${AWS_REGION}"
export NEXT_PUBLIC_COGNITO_DOMAIN="${NEXT_PUBLIC_COGNITO_DOMAIN:-rapidcortex-stg-158961537080.auth.us-east-1.amazoncognito.com}"
export COGNITO_DOMAIN="${NEXT_PUBLIC_COGNITO_DOMAIN}"

export ANTHROPIC_API_KEY_SECRET_ARN="${ANTHROPIC_API_KEY_SECRET_ARN:-arn:aws:secretsmanager:us-east-1:158961537080:secret:rapid-cortex/ai/anthropic-fHk4y2}"

# shellcheck source=scripts/lib/resolve-mapbox-token.sh
_ENV_SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]:-${(%):-%x}}")" && pwd)"
if [[ -f "${_ENV_SCRIPT_DIR}/lib/resolve-mapbox-token.sh" ]]; then
  # shellcheck disable=SC1091
  source "${_ENV_SCRIPT_DIR}/lib/resolve-mapbox-token.sh"
  resolve_mapbox_token || true
  resolve_mapbox_styles || true
fi
unset _ENV_SCRIPT_DIR
export NEXT_PUBLIC_MAPBOX_STYLE_URL_DARK="${NEXT_PUBLIC_MAPBOX_STYLE_URL_DARK:-mapbox://styles/memphman2004/cmr3afd69002401qq1uywfk5p}"
export NEXT_PUBLIC_MAPBOX_STYLE_URL_LIGHT="${NEXT_PUBLIC_MAPBOX_STYLE_URL_LIGHT:-mapbox://styles/memphman2004/cmsfheap9009w01s96hcr95b1}"
export NEXT_PUBLIC_MAPBOX_STYLE_URL="${NEXT_PUBLIC_MAPBOX_STYLE_URL:-${NEXT_PUBLIC_MAPBOX_STYLE_URL_DARK}}"
export NEXT_PUBLIC_MAPBOX_STYLE_DARK="${NEXT_PUBLIC_MAPBOX_STYLE_DARK:-${NEXT_PUBLIC_MAPBOX_STYLE_URL_DARK}}"
export NEXT_PUBLIC_MAPBOX_STYLE_LIGHT="${NEXT_PUBLIC_MAPBOX_STYLE_LIGHT:-${NEXT_PUBLIC_MAPBOX_STYLE_URL_LIGHT}}"

echo "✅ Staging SSR env ready — STACK_NAME=${STACK_NAME} APP_SUBDOMAIN_PREFIX=${APP_SUBDOMAIN_PREFIX} ATTACH_CLOUDFRONT_ALIASES=${ATTACH_CLOUDFRONT_ALIASES}"
if [[ -z "${CLOUDFRONT_CERT_ARN}" ]]; then
  echo "NOTE: CLOUDFRONT_CERT_ARN is empty. Run bash scripts/ensure-staging-acm-cert.sh or set ATTACH_APP_SUBDOMAIN_ALIAS=false for a cloudfront.net hostname." >&2
fi
if [[ -z "${COGNITO_USER_POOL_ID}" || -z "${API_BASE_URL}" ]]; then
  echo "NOTE: Cognito/API URLs are empty until rapid-cortex-staging exists. Run print-stack-outputs-for-web.sh staging after API deploy." >&2
fi
