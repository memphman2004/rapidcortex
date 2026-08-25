#!/usr/bin/env bash
# Request (or reuse) an ACM cert in us-east-1 for app-staging.rapidcortex.us and write DNS validation.
# The live CloudFront cert only covers app/www/report/apex — it cannot alias app-staging.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck source=scripts/lib/rapid-cortex-aws.sh
source "${ROOT}/scripts/lib/rapid-cortex-aws.sh"
rapid_cortex_assert_aws_account

export AWS_PROFILE="${AWS_PROFILE:-rapid-cortex}"
export AWS_REGION="${AWS_REGION:-us-east-1}"
export AWS_DEFAULT_REGION="${AWS_DEFAULT_REGION:-$AWS_REGION}"

DOMAIN="${STAGING_APP_DOMAIN:-app-staging.rapidcortex.us}"
HOSTED_ZONE_ID="${ROUTE53_HOSTED_ZONE_ID:-Z03951423J46LZ4YUDS6A}"
TOKEN="rcstgapp$(date +%Y%m%d)"

echo "Looking up existing ACM cert for ${DOMAIN}..."
CERT_ARN=""
# ListCertificates is denied for rapid-cortex-deploy; fall back to a known ARN env or request.
if [[ -n "${STAGING_CLOUDFRONT_CERT_ARN:-}" ]]; then
  CERT_ARN="${STAGING_CLOUDFRONT_CERT_ARN}"
fi

if [[ -z "${CERT_ARN}" ]]; then
  echo "Requesting ACM certificate (DNS validation) for ${DOMAIN}..."
  CERT_ARN="$(
    aws acm request-certificate \
      --region us-east-1 \
      --domain-name "${DOMAIN}" \
      --validation-method DNS \
      --idempotency-token "${TOKEN}" \
      --query CertificateArn \
      --output text
  )"
fi
echo "Certificate: ${CERT_ARN}"

echo "Waiting for DNS validation CNAME..."
CNAME_NAME=""
CNAME_VALUE=""
for _ in $(seq 1 20); do
  RECORD_JSON="$(
    aws acm describe-certificate \
      --region us-east-1 \
      --certificate-arn "${CERT_ARN}" \
      --query 'Certificate.DomainValidationOptions[0].ResourceRecord' \
      --output json
  )"
  CNAME_NAME="$(python3 -c "import json,sys; d=json.loads(sys.argv[1] or 'null'); print((d or {}).get('Name') or '')" "${RECORD_JSON}")"
  CNAME_VALUE="$(python3 -c "import json,sys; d=json.loads(sys.argv[1] or 'null'); print((d or {}).get('Value') or '')" "${RECORD_JSON}")"
  if [[ -n "${CNAME_NAME}" && -n "${CNAME_VALUE}" ]]; then
    break
  fi
  sleep 3
done
if [[ -z "${CNAME_NAME}" || -z "${CNAME_VALUE}" ]]; then
  echo "ERROR: ACM did not return a DNS validation record. Describe ${CERT_ARN} and retry." >&2
  exit 1
fi

echo "Upserting Route53 ${CNAME_NAME} → ${CNAME_VALUE}"
CHANGE_BATCH="$(python3 - <<PY
import json
print(json.dumps({
  "Comment": "ACM validation for ${DOMAIN}",
  "Changes": [{
    "Action": "UPSERT",
    "ResourceRecordSet": {
      "Name": "${CNAME_NAME}",
      "Type": "CNAME",
      "TTL": 300,
      "ResourceRecords": [{"Value": "${CNAME_VALUE}"}]
    }
  }]
}))
PY
)"
aws route53 change-resource-record-sets \
  --hosted-zone-id "${HOSTED_ZONE_ID}" \
  --change-batch "${CHANGE_BATCH}" \
  --query 'ChangeInfo.Id' \
  --output text

echo "Waiting for ACM ISSUED (up to ~5 minutes)..."
aws acm wait certificate-validated --region us-east-1 --certificate-arn "${CERT_ARN}"

STATUS="$(aws acm describe-certificate --region us-east-1 --certificate-arn "${CERT_ARN}" --query 'Certificate.Status' --output text)"
echo "Status: ${STATUS}"
echo "export CLOUDFRONT_CERT_ARN=${CERT_ARN}"
echo "export ALB_CERT_ARN=${CERT_ARN}"
echo "export STAGING_CLOUDFRONT_CERT_ARN=${CERT_ARN}"
