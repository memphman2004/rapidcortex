#!/usr/bin/env bash
# Deploy the static web stack (S3 + CloudFront + ACM + Route 53) in us-east-1.
# Prerequisites: public Route 53 hosted zone for the domain, AWS CLI, credentials.
#
# Required:
#   ROUTE53_HOSTED_ZONE_ID=Z...   (hosted zone for rapidcortex.us)
#
# Optional:
#   ROOT_DOMAIN=rapidcortex.us
#   APP_NAME=rapid-cortex
#   DEPLOYMENT_STAGE=prod
#   WEB_HOSTING_STACK_NAME=rapid-cortex-web-hosting-prod
#   WEB_CERTIFICATE_ARN=arn:aws:acm:us-east-1:...  (if you already have a us-east-1 cert for apex + www)
#   AWS_PROFILE (region forced to us-east-1 for this template)
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

export AWS_REGION="us-east-1"
export AWS_DEFAULT_REGION="us-east-1"

: "${ROUTE53_HOSTED_ZONE_ID:?Set ROUTE53_HOSTED_ZONE_ID to your public hosted zone id}"

ROOT_DOMAIN="${ROOT_DOMAIN:-rapidcortex.us}"
APP_NAME="${APP_NAME:-rapid-cortex}"
DEPLOYMENT_STAGE="${DEPLOYMENT_STAGE:-prod}"
WEB_HOSTING_STACK_NAME="${WEB_HOSTING_STACK_NAME:-${APP_NAME}-web-hosting-${DEPLOYMENT_STAGE}}"
WEB_CERTIFICATE_ARN="${WEB_CERTIFICATE_ARN:-}"

aws cloudformation deploy \
  --region "${AWS_REGION}" \
  --template-file "${ROOT}/infra/web-hosting-template.yaml" \
  --stack-name "${WEB_HOSTING_STACK_NAME}" \
  --capabilities CAPABILITY_IAM \
  --parameter-overrides \
  "DeploymentStage=${DEPLOYMENT_STAGE}" \
  "AppName=${APP_NAME}" \
  "RootDomainName=${ROOT_DOMAIN}" \
  "Route53HostedZoneId=${ROUTE53_HOSTED_ZONE_ID}" \
  "WebCertificateArn=${WEB_CERTIFICATE_ARN}" \
  --no-fail-on-empty-changeset

echo ""
echo "Stack outputs (bucket + CloudFront):"
aws cloudformation describe-stacks \
  --region "${AWS_REGION}" \
  --stack-name "${WEB_HOSTING_STACK_NAME}" \
  --query "Stacks[0].Outputs" \
  --output table
