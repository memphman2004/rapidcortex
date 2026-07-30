#!/usr/bin/env bash
# Deploy CloudFront + CLOUDFRONT-scope WAF in front of the primary HttpApi.
#
# Usage:
#   STAGE=dev \
#     API_GATEWAY_ORIGIN_DOMAIN=d-zp1gcdowhi.execute-api.us-east-1.amazonaws.com \
#     HTTP_API_ID=k26yw4o3xk \
#     VIEWER_CERT_ARN=arn:aws:acm:us-east-1:...:certificate/... \
#     bash scripts/deploy-api-edge.sh
#
# Cutover (recommended order):
#   1) CREATE_ROUTE53_ALIAS_RECORDS=false bash scripts/deploy-api-edge.sh   # CF + WAF + alias
#   2) Lean-deploy AppSam with ManageApiDomainDns=false (releases api.<root> A/AAAA)
#   3) CREATE_ROUTE53_ALIAS_RECORDS=true  bash scripts/deploy-api-edge.sh   # DNS → CloudFront
#   4) Verify: aws cloudfront get-distribution … WebACLId; curl https://api.<root>/api/health
#
# Required:
#   VIEWER_CERT_ARN — ACM in us-east-1 covering api.<ROOT_DOMAIN>
#   API_GATEWAY_ORIGIN_DOMAIN (preferred) and/or HTTP_API_ID
#
# Optional:
#   STAGE (default dev), APP_NAME, ROOT_DOMAIN, API_SUBDOMAIN_PREFIX
#   STACK_NAME (default ${APP_NAME}-api-edge-${STAGE})
#   ROUTE53_HOSTED_ZONE_ID (default look up RootDomain)
#   CREATE_ROUTE53_ALIAS_RECORDS (true|false, default false)
#   ATTACH_CLOUDFRONT_ALIAS (true|false, default true)
#   WAF_RATE_LIMIT_5M (default 2000)
#   AWS_PROFILE / AWS_REGION

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

STAGE="${STAGE:-dev}"
APP_NAME="${APP_NAME:-rapid-cortex}"
ROOT_DOMAIN="${ROOT_DOMAIN:-rapidcortex.us}"
API_SUBDOMAIN_PREFIX="${API_SUBDOMAIN_PREFIX:-api}"
STACK_NAME="${STACK_NAME:-${APP_NAME}-api-edge-${STAGE}}"
AWS_REGION="${AWS_REGION:-us-east-1}"
CREATE_ROUTE53_ALIAS_RECORDS="${CREATE_ROUTE53_ALIAS_RECORDS:-false}"
ATTACH_CLOUDFRONT_ALIAS="${ATTACH_CLOUDFRONT_ALIAS:-true}"
WAF_RATE_LIMIT_5M="${WAF_RATE_LIMIT_5M:-2000}"

: "${VIEWER_CERT_ARN:?VIEWER_CERT_ARN is required (ACM us-east-1 covering api.${ROOT_DOMAIN})}"

# Prefer regional custom-domain origin (Host: api.<root>). Fall back to HttpApiId execute-api origin.
if [[ -z "${API_GATEWAY_ORIGIN_DOMAIN:-}" && -n "${HTTP_API_ID:-}" ]]; then
  : # execute-api fallback below
elif [[ -z "${API_GATEWAY_ORIGIN_DOMAIN:-}" ]]; then
  : "${HTTP_API_ID:?Set API_GATEWAY_ORIGIN_DOMAIN (d-xxxx.execute-api...) or HTTP_API_ID}"
fi

if [[ -z "${ROUTE53_HOSTED_ZONE_ID:-}" ]]; then
  ROUTE53_HOSTED_ZONE_ID="$(aws route53 list-hosted-zones-by-name \
    --dns-name "${ROOT_DOMAIN}." \
    --query 'HostedZones[0].Id' \
    --output text | sed 's|/hostedzone/||')"
fi

if [[ "${CREATE_ROUTE53_ALIAS_RECORDS}" == "true" && -z "${ROUTE53_HOSTED_ZONE_ID}" ]]; then
  echo "ERROR: ROUTE53_HOSTED_ZONE_ID required when CREATE_ROUTE53_ALIAS_RECORDS=true" >&2
  exit 1
fi

ORIGIN_DISPLAY="${API_GATEWAY_ORIGIN_DOMAIN:-${HTTP_API_ID}.execute-api.${AWS_REGION}.amazonaws.com}"

echo "═══════════════════════════════════════════════════════"
echo " Rapid Cortex API edge (CloudFront + WAF)"
echo "═══════════════════════════════════════════════════════"
echo " Stack:          ${STACK_NAME}"
echo " Stage:          ${STAGE}"
echo " HttpApiId:      ${HTTP_API_ID:-(none)}"
echo " Origin:         ${ORIGIN_DISPLAY}"
echo " Alias:          ${ATTACH_CLOUDFRONT_ALIAS} → ${API_SUBDOMAIN_PREFIX}.${ROOT_DOMAIN}"
echo " Route53 DNS:    ${CREATE_ROUTE53_ALIAS_RECORDS}"
echo " Zone:           ${ROUTE53_HOSTED_ZONE_ID:-"(none)"}"
echo "═══════════════════════════════════════════════════════"

PARAM_OVERRIDES=(
  "AppName=${APP_NAME}"
  "DeploymentStage=${STAGE}"
  "RootDomainName=${ROOT_DOMAIN}"
  "ApiSubdomainPrefix=${API_SUBDOMAIN_PREFIX}"
  "AwsRegionForOrigin=${AWS_REGION}"
  "ViewerCertificateArn=${VIEWER_CERT_ARN}"
  "CreateRoute53AliasRecords=${CREATE_ROUTE53_ALIAS_RECORDS}"
  "AttachCloudFrontAlias=${ATTACH_CLOUDFRONT_ALIAS}"
  "WafRateLimitPer5Min=${WAF_RATE_LIMIT_5M}"
)
if [[ -n "${HTTP_API_ID:-}" ]]; then
  PARAM_OVERRIDES+=("HttpApiId=${HTTP_API_ID}")
fi
if [[ -n "${API_GATEWAY_ORIGIN_DOMAIN:-}" ]]; then
  PARAM_OVERRIDES+=("ApiGatewayOriginDomainName=${API_GATEWAY_ORIGIN_DOMAIN}")
fi
if [[ -n "${ROUTE53_HOSTED_ZONE_ID}" ]]; then
  PARAM_OVERRIDES+=("Route53HostedZoneId=${ROUTE53_HOSTED_ZONE_ID}")
fi

aws cloudformation deploy \
  --template-file "${ROOT}/infra/api-edge-cloudfront.yaml" \
  --stack-name "${STACK_NAME}" \
  --capabilities CAPABILITY_NAMED_IAM \
  --no-fail-on-empty-changeset \
  --parameter-overrides "${PARAM_OVERRIDES[@]}" \
  --region "${AWS_REGION}"

echo ""
echo "✅ Deploy complete. Outputs:"
aws cloudformation describe-stacks \
  --stack-name "${STACK_NAME}" \
  --region "${AWS_REGION}" \
  --query 'Stacks[0].Outputs[].[OutputKey,OutputValue]' \
  --output table

DIST_ID="$(aws cloudformation describe-stacks \
  --stack-name "${STACK_NAME}" \
  --region "${AWS_REGION}" \
  --query "Stacks[0].Outputs[?OutputKey=='ApiEdgeDistributionId'].OutputValue" \
  --output text)"
WAF_ARN="$(aws cloudformation describe-stacks \
  --stack-name "${STACK_NAME}" \
  --region "${AWS_REGION}" \
  --query "Stacks[0].Outputs[?OutputKey=='ApiEdgeWebAclArn'].OutputValue" \
  --output text)"

echo ""
echo "=== WAF attached to distribution? ==="
aws cloudfront get-distribution \
  --id "${DIST_ID}" \
  --query 'Distribution.DistributionConfig.WebACLId' \
  --output text

echo "Expected WebACL ARN: ${WAF_ARN}"
if [[ "${CREATE_ROUTE53_ALIAS_RECORDS}" != "true" ]]; then
  echo ""
  echo "Next: set AppSam ManageApiDomainDns=false, then re-run with CREATE_ROUTE53_ALIAS_RECORDS=true"
fi
