#!/usr/bin/env bash
# setup-help-cloudfront.sh
# Creates CloudFront OAC + distribution for s3://rapid-cortex-help-{STAGE}/help/
# and prints the NEXT_PUBLIC_HELP_CDN_BASE line to add to env-web-ssr-prod.sh.
#
# Naming: help content uses STAGE=prod (bucket rapid-cortex-help-prod). That is
# separate from CFN DeploymentStage=dev on stack rapid-cortex-dev, which is the
# live production API/Cognito environment in account 158961537080.
#
# Usage:
#   AWS_PROFILE=rapid-cortex STAGE=prod bash scripts/setup-help-cloudfront.sh
#
set -euo pipefail

REGION="${REGION:-us-east-1}"
STAGE="${STAGE:-prod}"
BUCKET="rapid-cortex-help-${STAGE}"
ACCOUNT="$(aws sts get-caller-identity --query Account --output text)"
OAC_NAME="rapid-cortex-help-${STAGE}-oac"
DIST_COMMENT="Rapid Cortex in-app help (${STAGE})"

echo "Account=${ACCOUNT} Bucket=${BUCKET} Region=${REGION}"

# Reuse existing OAC with the same name if present
OAC_ID="$(aws cloudfront list-origin-access-controls \
  --query "OriginAccessControlList.Items[?Name=='${OAC_NAME}'].Id | [0]" \
  --output text 2>/dev/null || true)"
if [[ -z "${OAC_ID}" || "${OAC_ID}" == "None" ]]; then
  echo "Creating Origin Access Control ${OAC_NAME}…"
  OAC_ID="$(aws cloudfront create-origin-access-control \
    --origin-access-control-config "{
      \"Name\": \"${OAC_NAME}\",
      \"Description\": \"OAC for ${BUCKET}\",
      \"SigningProtocol\": \"sigv4\",
      \"SigningBehavior\": \"always\",
      \"OriginAccessControlOriginType\": \"s3\"
    }" \
    --query 'OriginAccessControl.Id' --output text)"
fi
echo "OAC_ID=${OAC_ID}"

# Skip if a distribution already comments as help for this stage
EXISTING="$(aws cloudfront list-distributions \
  --query "DistributionList.Items[?Comment=='${DIST_COMMENT}'].DomainName | [0]" \
  --output text 2>/dev/null || true)"
if [[ -n "${EXISTING}" && "${EXISTING}" != "None" ]]; then
  echo "Distribution already exists: https://${EXISTING}"
  echo "export NEXT_PUBLIC_HELP_CDN_BASE=\"https://${EXISTING}/help\""
  exit 0
fi

CALLER_REF="rc-help-${STAGE}-$(date +%s)"
ORIGIN_DOMAIN="${BUCKET}.s3.${REGION}.amazonaws.com"

cat > /tmp/rc-help-cf-dist.json <<EOF
{
  "CallerReference": "${CALLER_REF}",
  "Comment": "${DIST_COMMENT}",
  "Enabled": true,
  "DefaultRootObject": "",
  "Origins": {
    "Quantity": 1,
    "Items": [
      {
        "Id": "help-s3",
        "DomainName": "${ORIGIN_DOMAIN}",
        "OriginPath": "/help",
        "S3OriginConfig": { "OriginAccessIdentity": "" },
        "OriginAccessControlId": "${OAC_ID}"
      }
    ]
  },
  "DefaultCacheBehavior": {
    "TargetOriginId": "help-s3",
    "ViewerProtocolPolicy": "redirect-to-https",
    "AllowedMethods": {
      "Quantity": 2,
      "Items": ["GET", "HEAD"],
      "CachedMethods": { "Quantity": 2, "Items": ["GET", "HEAD"] }
    },
    "Compress": true,
    "CachePolicyId": "658327ea-f89d-4fab-a63d-7e88639e58f6",
    "OriginRequestPolicyId": "88a5eaf4-2fd4-4709-b370-b4c650ea3fc5"
  },
  "PriceClass": "PriceClass_100",
  "ViewerCertificate": { "CloudFrontDefaultCertificate": true },
  "HttpVersion": "http2"
}
EOF

echo "Creating CloudFront distribution…"
DIST_JSON="$(aws cloudfront create-distribution --distribution-config file:///tmp/rc-help-cf-dist.json)"
DIST_ID="$(echo "${DIST_JSON}" | python3 -c 'import sys,json; print(json.load(sys.stdin)["Distribution"]["Id"])')"
DIST_DOMAIN="$(echo "${DIST_JSON}" | python3 -c 'import sys,json; print(json.load(sys.stdin)["Distribution"]["DomainName"])')"
echo "DIST_ID=${DIST_ID}"
echo "DIST_DOMAIN=${DIST_DOMAIN}"

# Bucket policy for this OAC
cat > /tmp/rc-help-bucket-policy.json <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AllowCloudFrontServicePrincipalRead",
      "Effect": "Allow",
      "Principal": { "Service": "cloudfront.amazonaws.com" },
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::${BUCKET}/help/*",
      "Condition": {
        "StringEquals": {
          "AWS:SourceArn": "arn:aws:cloudfront::${ACCOUNT}:distribution/${DIST_ID}"
        }
      }
    }
  ]
}
EOF
aws s3api put-bucket-policy --bucket "${BUCKET}" --policy file:///tmp/rc-help-bucket-policy.json
echo "✓ Bucket policy attached for distribution ${DIST_ID}"

echo ""
echo "=== Add to scripts/env-web-ssr-prod.sh ==="
echo "export NEXT_PUBLIC_HELP_CDN_BASE=\"https://${DIST_DOMAIN}/help\""
echo ""
echo "Distribution may take a few minutes to deploy (Status=Deployed)."
