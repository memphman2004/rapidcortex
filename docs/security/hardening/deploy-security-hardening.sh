#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Rapid Cortex — Security Hardening Stack Deploy
#
# Deploys: CloudFront WAF (us-east-1) + Regional WAF + GuardDuty + Audit Logs
#
# IMPORTANT: CloudFront WAF MUST be deployed to us-east-1 regardless of your
# primary application region. Regional WAF deploys to AWS_DEFAULT_REGION.
#
# Usage:
#   ./deploy-security-hardening.sh
#
# Required env:
#   APP_NAME              (default: rapid-cortex)
#   STAGE                 (default: prod)
#   ALERT_EMAIL           Security alert email (GuardDuty + WAF alarms)
#
# Optional env:
#   AGENCY_CIDRS          Comma-separated known agency CIDRs (default: placeholder)
#                         Example: "203.0.113.10/32,198.51.100.0/24"
#   WAF_RATE_LIMIT        Requests/IP/5min at CDN (default: 2000)
#   API_RATE_LIMIT        Requests/IP/5min at API (default: 500)
#   SKIP_GUARDDUTY        Set to "true" to skip GuardDuty (if already enabled)
#   DRY_RUN               Set to "true" to validate templates only
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

APP_NAME="${APP_NAME:-rapid-cortex}"
STAGE="${STAGE:-prod}"
ALERT_EMAIL="${ALERT_EMAIL:-}"
AGENCY_CIDRS="${AGENCY_CIDRS:-203.0.113.0/32}"
WAF_RATE_LIMIT="${WAF_RATE_LIMIT:-2000}"
API_RATE_LIMIT="${API_RATE_LIMIT:-500}"
SKIP_GUARDDUTY="${SKIP_GUARDDUTY:-false}"
DRY_RUN="${DRY_RUN:-false}"

# CloudFront WAF must be deployed in us-east-1
CDN_REGION="us-east-1"
STACK_NAME="${APP_NAME}-security-hardening-${STAGE}"
TEMPLATE_FILE="$(dirname "$0")/rc-security-hardening.yaml"

# ── Pre-flight checks ─────────────────────────────────────────────────────────
if [[ -z "$ALERT_EMAIL" ]]; then
  echo "ERROR: ALERT_EMAIL is required (security alerts destination)" >&2
  exit 1
fi

if [[ ! -f "$TEMPLATE_FILE" ]]; then
  echo "ERROR: Template not found at ${TEMPLATE_FILE}" >&2
  exit 1
fi

echo "──────────────────────────────────────────────────────────────────────"
echo "  Rapid Cortex — Security Hardening Deploy"
echo "  Stack:    ${STACK_NAME}"
echo "  Region:   ${CDN_REGION} (CloudFront WAF must be us-east-1)"
echo "  Stage:    ${STAGE}"
echo "  Alerts:   ${ALERT_EMAIL}"
echo "  GuardDuty: $([ "$SKIP_GUARDDUTY" == "true" ] && echo "SKIPPED" || echo "ENABLED")"
echo "──────────────────────────────────────────────────────────────────────"

# ── Validate template ─────────────────────────────────────────────────────────
echo "[1/3] Validating CloudFormation template..."
aws cloudformation validate-template \
  --template-body "file://${TEMPLATE_FILE}" \
  --region "${CDN_REGION}" \
  > /dev/null

echo "      ✓ Template valid"

if [[ "$DRY_RUN" == "true" ]]; then
  echo "[DRY RUN] Validation complete. Skipping deploy."
  exit 0
fi

# ── Deploy security stack ─────────────────────────────────────────────────────
echo "[2/3] Deploying security hardening stack to ${CDN_REGION}..."

PARAMS="AppName=${APP_NAME}"
PARAMS="${PARAMS} DeploymentStage=${STAGE}"
PARAMS="${PARAMS} GuardDutyAlertEmail=${ALERT_EMAIL}"
PARAMS="${PARAMS} WafRateLimitPer5Min=${WAF_RATE_LIMIT}"
PARAMS="${PARAMS} ApiRateLimitPer5Min=${API_RATE_LIMIT}"
PARAMS="${PARAMS} AgencyAllowlistCIDRs=${AGENCY_CIDRS}"
PARAMS="${PARAMS} EnableGuardDuty=$([ "$SKIP_GUARDDUTY" == "true" ] && echo "false" || echo "true")"

aws cloudformation deploy \
  --template-file "${TEMPLATE_FILE}" \
  --stack-name "${STACK_NAME}" \
  --parameter-overrides ${PARAMS} \
  --capabilities CAPABILITY_IAM CAPABILITY_NAMED_IAM \
  --region "${CDN_REGION}" \
  --no-fail-on-empty-changeset

# ── Print outputs for downstream stacks ──────────────────────────────────────
echo "[3/3] Stack deployed. Outputs (add to web-ssr-infra deploy env):"
echo ""

CDN_ACL_ARN=$(aws cloudformation describe-stacks \
  --stack-name "${STACK_NAME}" \
  --region "${CDN_REGION}" \
  --query "Stacks[0].Outputs[?OutputKey=='CdnWebAclArn'].OutputValue" \
  --output text)

CDN_ACL_ID=$(aws cloudformation describe-stacks \
  --stack-name "${STACK_NAME}" \
  --region "${CDN_REGION}" \
  --query "Stacks[0].Outputs[?OutputKey=='CdnWebAclId'].OutputValue" \
  --output text)

API_ACL_ARN=$(aws cloudformation describe-stacks \
  --stack-name "${STACK_NAME}" \
  --region "${CDN_REGION}" \
  --query "Stacks[0].Outputs[?OutputKey=='ApiSecurityWebAclArn'].OutputValue" \
  --output text)

SNS_TOPIC=$(aws cloudformation describe-stacks \
  --stack-name "${STACK_NAME}" \
  --region "${CDN_REGION}" \
  --query "Stacks[0].Outputs[?OutputKey=='SecurityAlertsTopicArn'].OutputValue" \
  --output text)

AGENCY_CDN_SET=$(aws cloudformation describe-stacks \
  --stack-name "${STACK_NAME}" \
  --region "${CDN_REGION}" \
  --query "Stacks[0].Outputs[?OutputKey=='AgencyAllowlistIPSetCdnArn'].OutputValue" \
  --output text)

echo "──────────────────────────────────────────────────────────────────────"
echo ""
echo "# ── Add to deploy-web-ssr.sh env / web-ssr-infra-template.yaml ──────"
echo "CDN_WAF_ACL_ARN=${CDN_ACL_ARN}"
echo "CDN_WAF_ACL_ID=${CDN_ACL_ID}"
echo ""
echo "# ── Add to deploy.sh / SAM API stacks ───────────────────────────────"
echo "API_WAF_ACL_ARN=${API_ACL_ARN}"
echo ""
echo "# ── Security alerts SNS ─────────────────────────────────────────────"
echo "SECURITY_ALERTS_TOPIC=${SNS_TOPIC}"
echo ""
echo "# ── Agency allowlist IP set (update CIDRs at each agency onboarding) ─"
echo "AGENCY_ALLOWLIST_IP_SET_ARN=${AGENCY_CDN_SET}"
echo ""
echo "──────────────────────────────────────────────────────────────────────"
echo ""
echo "NEXT STEPS:"
echo "  1. Confirm alert email subscription (check ${ALERT_EMAIL} inbox)"
echo "  2. Set CDN_WAF_ACL_ID in your CloudFront distribution WebACLId param"
echo "  3. Associate API_WAF_ACL_ARN with each API Gateway stage:"
echo "     aws wafv2 associate-web-acl \\"
echo "       --web-acl-arn \${API_WAF_ACL_ARN} \\"
echo "       --resource-arn <api-gateway-stage-arn> \\"
echo "       --region \${AWS_DEFAULT_REGION}"
echo "  4. Monitor WAF blocked requests in CloudWatch for 24h before hardening"
echo "     HostingProviderIPList from Count → Block"
echo "  5. Add real agency CIDRs to AGENCY_CIDRS and redeploy"
echo ""
echo "✓ Security hardening stack deployed successfully"
