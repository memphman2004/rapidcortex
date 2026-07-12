#!/usr/bin/env bash
# setup-help-s3.sh
# Creates the S3 bucket + folder structure for in-app help content.
# Run once from the repo root with your deploy AWS profile.
#
# Usage:
#   REGION=us-east-1 STAGE=prod bash scripts/setup-help-s3.sh
#   AWS_PROFILE=rapid-cortex REGION=us-east-1 STAGE=prod bash scripts/setup-help-s3.sh

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
REGION="${REGION:-us-east-1}"
STAGE="${STAGE:-prod}"
BUCKET="rapid-cortex-help-${STAGE}"

if [[ -n "${AWS_PROFILE:-}" ]]; then
  export AWS_PROFILE
fi

echo ""
echo "=== Rapid Cortex Help Content S3 Setup ==="
echo "Bucket : s3://${BUCKET}"
echo "Region : ${REGION}"
echo "Profile: ${AWS_PROFILE:-default}"
echo ""

# ── 1. Create bucket ────────────────────────────────────────────────────────
if aws s3api head-bucket --bucket "${BUCKET}" --region "${REGION}" 2>/dev/null; then
  echo "✓  Bucket already exists: ${BUCKET}"
else
  echo "Creating bucket: ${BUCKET}..."
  if [[ "${REGION}" == "us-east-1" ]]; then
    aws s3api create-bucket \
      --bucket "${BUCKET}" \
      --region "${REGION}"
  else
    aws s3api create-bucket \
      --bucket "${BUCKET}" \
      --region "${REGION}" \
      --create-bucket-configuration LocationConstraint="${REGION}"
  fi
  echo "✓  Bucket created"
fi

# ── 2. Block all public access ──────────────────────────────────────────────
echo "Blocking public access..."
aws s3api put-public-access-block \
  --bucket "${BUCKET}" \
  --region "${REGION}" \
  --public-access-block-configuration \
    "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true"
echo "✓  Public access blocked"

# ── 3. Enable versioning ────────────────────────────────────────────────────
echo "Enabling versioning..."
aws s3api put-bucket-versioning \
  --bucket "${BUCKET}" \
  --region "${REGION}" \
  --versioning-configuration Status=Enabled
echo "✓  Versioning enabled"

# ── 4. Seed folder structure with placeholder README files ──────────────────
echo ""
echo "Seeding folder structure..."

# Keys must match apps/web/lib/help/help-content.ts HELP_INDEX
ROLES=(
  "dispatcher"
  "supervisor"
  "agencyadmin"
  "agencyit"
  "analyst"
  "auditor"
  "campus_admin"
  "campus_supervisor"
  "campus_security"
  "campus_counselor"
  "campus_faculty"
  "venue_admin"
  "venue_supervisor"
  "venue_security"
  "hospital_admin"
  "hospital_staff"
  "transit_admin"
  "transit_security"
  "rcadmin"
  "rcitadmin"
)

for ROLE in "${ROLES[@]}"; do
  README_CONTENT="# Help articles for role: ${ROLE}
Upload .md files to this folder.
Each file becomes an article in the in-app Help panel.
Filename = topic key defined in apps/web/lib/help/help-content.ts

Example:
  s3://${BUCKET}/help/${ROLE}/index.md       → overview article
  s3://${BUCKET}/help/${ROLE}/silent-text.md → silent text guide

Content-Type must be text/markdown.
Cache-Control: max-age=300
"
  echo "${README_CONTENT}" | aws s3 cp - \
    "s3://${BUCKET}/help/${ROLE}/README.md" \
    --content-type "text/markdown" \
    --cache-control "no-cache" \
    --region "${REGION}" \
    --quiet
  echo "  ✓  help/${ROLE}/"
done

# ── 5. Upload the first real article (dispatcher/silent-text.md) ────────────
SILENT_TEXT_ARTICLE="${ROOT}/docs/help/dispatcher/silent-text.md"
if [[ ! -f "${SILENT_TEXT_ARTICLE}" ]]; then
  SILENT_TEXT_ARTICLE="${ROOT}/apps/web/public/help/dispatcher/silent-text.md"
fi
if [[ -f "${SILENT_TEXT_ARTICLE}" ]]; then
  echo ""
  echo "Uploading first article: dispatcher/silent-text.md..."
  aws s3 cp "${SILENT_TEXT_ARTICLE}" \
    "s3://${BUCKET}/help/dispatcher/silent-text.md" \
    --content-type "text/markdown" \
    --cache-control "max-age=300, s-maxage=300" \
    --region "${REGION}"
  echo "✓  dispatcher/silent-text.md uploaded"
else
  echo ""
  echo "⚠  No silent-text.md found under docs/help/dispatcher/ or apps/web/public/help/dispatcher/"
fi

# ── 6. Print next steps ─────────────────────────────────────────────────────
echo ""
echo "=== Setup complete ==="
echo ""
echo "Next steps:"
echo ""
echo "1. Add a CloudFront origin pointing to this bucket:"
echo "   Origin domain : ${BUCKET}.s3.${REGION}.amazonaws.com"
echo "   Origin path   : /help"
echo "   OAC           : create one in CloudFront → Origin access → Create control setting"
echo "   Cache TTL     : 300s (matches Cache-Control header on articles)"
echo ""
echo "2. Add the CloudFront distribution URL to scripts/env-web-ssr-prod.sh:"
echo "   export NEXT_PUBLIC_HELP_CDN_BASE=\"https://<your-cf-domain>/help\""
echo ""
echo "3. Upload help articles:"
echo "   aws s3 cp docs/help/dispatcher/silent-text.md \\"
echo "     s3://${BUCKET}/help/dispatcher/silent-text.md \\"
echo "     --content-type text/markdown \\"
echo "     --cache-control \"max-age=300\""
echo ""
echo "4. Sync all articles at once (skips INTEGRATION.md):"
echo "   aws s3 sync docs/help/ s3://${BUCKET}/help/ \\"
echo "     --exclude 'INTEGRATION.md' --exclude '*/INTEGRATION.md' \\"
echo "     --content-type text/markdown \\"
echo "     --cache-control \"max-age=300\""
echo ""
echo "5. List what's in the bucket:"
echo "   aws s3 ls s3://${BUCKET}/help/ --recursive --region ${REGION}"
echo ""
