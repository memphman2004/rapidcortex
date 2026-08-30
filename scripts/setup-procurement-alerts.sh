#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# setup-procurement-alerts.sh
#
# Step-by-step guide for registering with all seven gov-procurement portals
# and pointing their keyword alert emails at the RC ingestion inbox.
#
# Usage:
#   STAGE=prod REGION=us-east-1 INBOUND_EMAIL=procurement-signals@signals.rapidcortex.com \
#   bash scripts/setup-procurement-alerts.sh [check|guide|secret]
#
# Sub-commands:
#   guide   (default) Print per-portal registration steps
#   check   Validate that SES domain is verified and Lambda is live
#   secret  Confirm the existing Anthropic secret in Secrets Manager
#           (does not create, prompt for, or overwrite the key)
#
# Anthropic key:
#   Already stored as rapid-cortex/ai/anthropic (JSON {"apiKey":"sk-ant-..."}).
#   Lambdas receive only ANTHROPIC_API_KEY_SECRET_ARN and call GetSecretValue
#   at runtime. The in-process cache TTL is 5 minutes, so a rotated value is
#   picked up on the next fetch after TTL (or on a cold start).
#   Do not put the raw key in Lambda environment variables.
#
# Rapid Cortex notes:
#   STAGE=dev is live production (rapid-cortex-dev), not a sandbox.
#   Engineering isolation uses STAGE=staging.
#   Compatible with macOS /bin/bash 3.2 (no associative arrays).
# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail

STAGE="${STAGE:-dev}"
REGION="${REGION:-${AWS_REGION:-us-east-1}}"
INBOUND_EMAIL="${INBOUND_EMAIL:-}"
# Platform secret already deployed. Override only if you must point at a different name.
SECRET_NAME="${SECRET_NAME:-rapid-cortex/ai/anthropic}"
CMD="${1:-guide}"

AWS_ARGS=(--region "$REGION")
if [[ -n "${AWS_PROFILE:-}" ]]; then
  AWS_ARGS+=(--profile "$AWS_PROFILE")
fi

# ── Keyword list — register ALL of these on each portal ───────────────────────
KEYWORDS=(
  "911 communications software"
  "PSAP software"
  "public safety answering point software"
  "emergency communications platform"
  "emergency communications center software"
  "ECC software"
  "dispatch intelligence"
  "AI dispatch"
  "CAD integration software"
  "call intelligence platform"
  "campus safety software"
  "campus emergency communications"
  "venue safety software"
  "stadium security software"
  "hospital emergency communications software"
  "transit emergency communications"
  "emergency management software"
  "incident command software"
  "real-time incident management"
)

# ── NAICS / NIGP codes to select on portals ───────────────────────────────────
NAICS_CODES=(
  "541511"   # Custom Computer Programming Services
  "541512"   # Computer Systems Design Services
  "541519"   # Other Computer Related Services
  "518210"   # Data Processing, Hosting
  "922120"   # Police Protection (gov classification)
  "922160"   # Fire Protection
)

NIGP_CODES=(
  "20800"    # Data/Software/Systems
  "20814"    # Computer Software — Applications
  "20900"    # Computers and Computer Equipment
  "91800"    # Public Safety/Police Equipment
  "91500"    # Emergency Management Equipment
)

print_portal() {
  local name="$1"
  local url="$2"
  shift 2
  echo "──────────────────────────────────────────────────────────────────"
  echo "  ${name}"
  echo "  URL: ${url}"
  echo ""
  echo "  Alert email to register: ${INBOX}"
  echo ""
  local line
  for line in "$@"; do
    echo "  ${line}"
  done
  echo ""
}

# ─────────────────────────────────────────────────────────────────────────────
if [[ "$CMD" == "secret" ]]; then
  echo "═══════════════════════════════════════════════════════════"
  echo " Anthropic API key — verify existing Secrets Manager secret"
  echo " Stage: $STAGE  |  Region: $REGION"
  echo "═══════════════════════════════════════════════════════════"
  echo ""
  echo "  This command does not create or rotate the key."
  echo "  Runtime Lambdas fetch it via GetSecretValue (ARN only in env)."
  echo ""

  LOOKUP_ID="${ANTHROPIC_API_KEY_SECRET_ARN:-$SECRET_NAME}"

  SECRET_ARN=$(aws secretsmanager describe-secret \
    --secret-id "$LOOKUP_ID" \
    "${AWS_ARGS[@]}" \
    --query "ARN" \
    --output text 2>/dev/null || echo "NOT_FOUND")

  if [[ "$SECRET_ARN" == "NOT_FOUND" ]]; then
    echo "  ❌  Secret '$LOOKUP_ID' not found"
    echo "      Expected name: rapid-cortex/ai/anthropic"
    echo "      Expected ARN (prod): arn:aws:secretsmanager:${REGION}:158961537080:secret:rapid-cortex/ai/anthropic-fHk4y2"
    echo "      Rotate with: aws secretsmanager put-secret-value --secret-id rapid-cortex/ai/anthropic --secret-string '{\"apiKey\":\"sk-ant-...\"}'"
    exit 1
  fi

  LAST_CHANGED=$(aws secretsmanager describe-secret \
    --secret-id "$LOOKUP_ID" \
    "${AWS_ARGS[@]}" \
    --query "LastChangedDate" \
    --output text 2>/dev/null || echo "unknown")

  KEY_SHAPE=$(aws secretsmanager get-secret-value \
    --secret-id "$LOOKUP_ID" \
    "${AWS_ARGS[@]}" \
    --query "SecretString" \
    --output text 2>/dev/null | python3 -c '
import json, sys
raw = sys.stdin.read().strip()
if not raw or raw == "None":
    print("EMPTY")
    sys.exit(0)
try:
    obj = json.loads(raw)
except json.JSONDecodeError:
    print("PLAIN_STRING" if raw.startswith("sk-") else "UNPARSED")
    sys.exit(0)
key = obj.get("apiKey") or obj.get("ANTHROPIC_API_KEY") or ""
print("JSON_apiKey" if isinstance(key, str) and key.strip() else "JSON_MISSING_apiKey")
')

  echo "  ✅  $LOOKUP_ID"
  echo "      ARN: $SECRET_ARN"
  echo "      LastChanged: $LAST_CHANGED"
  echo "      Payload: $KEY_SHAPE (value not printed)"
  echo ""
  echo "  Deploy already passes this ARN as AnthropicApiKeySecretArn."
  echo "  After a secret rotation, warm Lambdas pick up the new value within"
  echo "  ~5 minutes (runtimeSecrets cache TTL) or immediately on cold start."
  exit 0
fi

# ─────────────────────────────────────────────────────────────────────────────
if [[ "$CMD" == "check" ]]; then
  echo "═══════════════════════════════════════════════════════════"
  echo " Procurement Ingestion Infrastructure Check"
  echo " Stage: $STAGE  |  Region: $REGION"
  echo "═══════════════════════════════════════════════════════════"
  echo ""

  LAMBDA_NAME="rc-procurement-ingestion-${STAGE}"
  BUCKET_PATTERN="rc-procurement-signals-"

  echo "▶ Lambda function..."
  LAMBDA_STATE=$(aws lambda get-function \
    --function-name "$LAMBDA_NAME" \
    "${AWS_ARGS[@]}" \
    --query "Configuration.State" \
    --output text 2>/dev/null || echo "NOT_FOUND")

  if [[ "$LAMBDA_STATE" == "Active" ]]; then
    echo "  ✅  $LAMBDA_NAME — Active"
  else
    echo "  ❌  $LAMBDA_NAME — $LAMBDA_STATE (deploy SAM stack first)"
  fi

  echo ""
  echo "▶ S3 email bucket..."
  BUCKET_NAME=$(aws s3api list-buckets \
    "${AWS_ARGS[@]}" \
    --query "Buckets[?starts_with(Name, '${BUCKET_PATTERN}')].Name" \
    --output text 2>/dev/null || echo "")

  if [[ -n "$BUCKET_NAME" ]]; then
    echo "  ✅  $BUCKET_NAME — exists"
    FIRST_BUCKET="${BUCKET_NAME%%[[:space:]]*}"
    OBJ_COUNT=$(aws s3api list-objects-v2 \
      --bucket "$FIRST_BUCKET" \
      --prefix "inbound/" \
      "${AWS_ARGS[@]}" \
      --query "KeyCount" \
      --output text 2>/dev/null || echo "0")
    echo "      Raw emails stored: $OBJ_COUNT"
  else
    echo "  ❌  No bucket matching '$BUCKET_PATTERN' found"
  fi

  echo ""
  echo "▶ SES domain verification..."
  if [[ -n "$INBOUND_EMAIL" ]]; then
    DOMAIN="${INBOUND_EMAIL##*@}"
    IDENTITY_STATUS=$(aws ses get-identity-verification-attributes \
      --identities "$DOMAIN" \
      "${AWS_ARGS[@]}" \
      --query "VerificationAttributes.\"${DOMAIN}\".VerificationStatus" \
      --output text 2>/dev/null || echo "NOT_FOUND")
    if [[ "$IDENTITY_STATUS" == "Success" ]]; then
      echo "  ✅  $DOMAIN — verified"
    else
      echo "  ❌  $DOMAIN — $IDENTITY_STATUS"
      echo "      Run: aws ses verify-domain-identity --domain $DOMAIN --region $REGION"
    fi
  else
    echo "  ⚠️   Set INBOUND_EMAIL env var to check SES domain"
  fi

  echo ""
  echo "▶ Anthropic secret (runtime GetSecretValue)..."
  LOOKUP_ID="${ANTHROPIC_API_KEY_SECRET_ARN:-$SECRET_NAME}"
  SECRET_ARN=$(aws secretsmanager describe-secret \
    --secret-id "$LOOKUP_ID" \
    "${AWS_ARGS[@]}" \
    --query "ARN" \
    --output text 2>/dev/null || echo "NOT_FOUND")
  if [[ "$SECRET_ARN" == "NOT_FOUND" ]]; then
    echo "  ❌  Secret '$LOOKUP_ID' not found"
    echo "      Expected: rapid-cortex/ai/anthropic"
    echo "      Confirm: STAGE=$STAGE bash $0 secret"
  else
    echo "  ✅  $LOOKUP_ID — exists"
    echo "      ARN: $SECRET_ARN"
    echo "      Lambdas must use ANTHROPIC_API_KEY_SECRET_ARN (not a plaintext env key)"
  fi

  exit 0
fi

# ─────────────────────────────────────────────────────────────────────────────
# DEFAULT: guide
# ─────────────────────────────────────────────────────────────────────────────
INBOX="${INBOUND_EMAIL:-procurement-signals@signals.rapidcortex.com}"

echo ""
echo "╔══════════════════════════════════════════════════════════════════╗"
echo "║   RAPID CORTEX — Gov Procurement Alert Setup Guide              ║"
echo "║   Register the inbox below on all seven portals                 ║"
echo "╚══════════════════════════════════════════════════════════════════╝"
echo ""
echo "  Inbound email address: ${INBOX}"
echo ""
echo "  This address receives keyword alert emails from each portal."
echo "  The ingestion Lambda parses them and creates leads in rapidIQ."
echo ""

echo "── Keywords to register on every portal ──────────────────────────"
for kw in "${KEYWORDS[@]}"; do
  echo "  • $kw"
done
echo ""
echo "── NAICS codes to select ─────────────────────────────────────────"
for code in "${NAICS_CODES[@]}"; do echo "  • $code"; done
echo ""
echo "── NIGP codes to select ──────────────────────────────────────────"
for code in "${NIGP_CODES[@]}"; do echo "  • $code"; done
echo ""

print_portal "1. Bonfire" "https://gobonfire.com/vendors" \
  "Register as vendor → Vendor Preferences → Opportunity Alerts." \
  "Set NAICS codes + add each keyword. Alert emails come from gobonfire.com."

print_portal "2. BidNet Direct" "https://www.bidnetdirect.com/register" \
  "Free vendor account → My Account → Notification Settings." \
  "Select NIGP codes 20800, 20814, 20900. Add keyword list." \
  "Alert emails come from bidnetdirect.com."

print_portal "3. DemandStar" "https://network.demandstar.com/register" \
  "Register at Supplier hub → Supplier Preferences." \
  "Add commodity codes 20-000, 20-800. Enable email notifications." \
  "Alert emails come from demandstar.com."

print_portal "4. Ion Wave" "https://www.ionwave.net/VendorRegistration.aspx" \
  "Vendor registration form. Select commodity codes for software" \
  "and public safety. Enable bid notification emails from ionwave.net."

print_portal "5. JAGGAER" "https://solutions.jaggaer.com/supplier-portal" \
  "JAGGAER buyer portals vary by customer. Target:" \
  "UNC System → jaggaer.unc.edu | FL colleges → supplier.fl.gov" \
  "State of TX → txsmartbuy.gov | Register separately on each." \
  "Alert emails come from jaggaer.com or sciquest.com."

print_portal "6. PlanetBids" "https://www.planetbids.com/portal/portal.cfm" \
  "Free vendor account. Strong CA/TX/FL coverage." \
  "Set NIGP codes and keyword preferences in vendor profile." \
  "Alert emails come from planetbids.com — good for RC Campus + RC Venue."

print_portal "7. Periscope S2G / BidSync" "https://www.bidsync.com/bidsync-app/vendor/reg/" \
  "Register at bidsync.com for S2G vendor access." \
  "Add commodity codes for IT, public safety, communications." \
  "Alert emails come from bidsync.com or periscopeholdings.com."

echo "══════════════════════════════════════════════════════════════════"
echo "  DEPLOYMENT CHECKLIST"
echo "══════════════════════════════════════════════════════════════════"
echo ""
echo "  [ ] 1. Verify SES domain: aws ses verify-domain-identity \\"
echo "              --domain signals.rapidcortex.com --region $REGION"
echo "  [ ] 2. Confirm Anthropic secret (already in AWS): STAGE=$STAGE bash $0 secret"
echo "         Uses rapid-cortex/ai/anthropic — Lambdas fetch at runtime via ARN"
echo "  [ ] 3. Add SAM resources from procurement-ingestion-sam.yaml"
echo "         (not in repo yet — Rapid IQ collectors live in stack-app-sam-rapid-iq-pipeline.yaml)"
echo "  [ ] 4. Deploy already injects AnthropicApiKeySecretArn from env-api-*.sh"
echo "         (do not create rc-anthropic-api-key-* or put the raw key in Lambda env)"
echo "  [ ] 5. Register $INBOX on all 7 portals (guide above)"
echo "  [ ] 6. Send a test email to $INBOX and verify lead appears in rapidIQ"
echo "  [ ] 7. Run: STAGE=$STAGE bash $0 check"
echo ""
echo "  Expected cost: ~\$0.002 per email processed (Haiku pricing)."
echo "  At 20 alerts/day: ~\$1.20/month."
echo ""
