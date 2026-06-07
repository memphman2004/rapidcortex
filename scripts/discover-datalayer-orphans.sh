#!/usr/bin/env bash
# discover-datalayer-orphans.sh
#
# Verifies that each expected orphaned resource (exists in AWS, not yet owned
# by the DataLayer stack) is present with the expected physical name.
#
# Run this BEFORE import-data-layer-tables.sh to confirm physical names.
# Output: prints the resources-to-import-new.json content to stdout.
#        Exit 1 if any expected resource is missing from AWS.
#
# Usage:
#   export AWS_REGION=us-east-1
#   bash scripts/discover-datalayer-orphans.sh
#   # If all green, output is the JSON to use for the import.
#
set -euo pipefail

REGION="${AWS_REGION:-${AWS_DEFAULT_REGION:-us-east-1}}"
ACCOUNT_ID="158961537080"   # from existing resources-to-import.json S3 entries
STAGE="dev"

die()  { echo "ERROR: $*" >&2; exit 1; }
ok()   { echo "  ✓ $*"; }
fail() { echo "  ✗ MISSING: $*" >&2; FAILED=$((FAILED + 1)); }

need() { command -v "$1" >/dev/null 2>&1 || die "missing tool: $1"; }
need aws
need jq

FAILED=0

echo "=== DataLayer orphan resource check (region=$REGION, account=$ACCOUNT_ID) ==="
echo ""

# ─── DynamoDB tables ──────────────────────────────────────────────────────────
check_table() {
  local logical="$1" physical="$2"
  if aws dynamodb describe-table --table-name "$physical" \
       --region "$REGION" --output text --query 'Table.TableName' \
       >/dev/null 2>&1; then
    ok "DynamoDB $logical → $physical"
  else
    fail "DynamoDB $logical → $physical (not found in AWS)"
  fi
}

echo "DynamoDB tables:"
check_table "QRLocationsTable"          "rapid-cortex-qr-locations-${STAGE}"
check_table "CampusConfigTable"         "rapid-cortex-campus-config-${STAGE}"
check_table "CampusIncidentsTable"      "rapid-cortex-campus-incidents-${STAGE}"
check_table "VenueConfigTable"          "rapid-cortex-venue-config-${STAGE}"
check_table "VenueAssetsTable"          "rapid-cortex-venue-assets-${STAGE}"
check_table "VenueFacilitiesTable"      "rapid-cortex-venue-facilities-${STAGE}"
check_table "ConnectRegistryTable"      "rapid-cortex-connect-registry-${STAGE}"
check_table "ConnectEvidenceTable"      "rapid-cortex-connect-evidence-${STAGE}"
check_table "ConnectAccessSessionsTable" "rapid-cortex-connect-sessions-${STAGE}"
check_table "ConnectAccessLogTable"     "rapid-cortex-connect-access-log-${STAGE}"
check_table "PlatformNoticesTable"      "rapid-cortex-platform-notices-${STAGE}"
check_table "PlatformNoticeAcksTable"   "rapid-cortex-platform-notice-acks-${STAGE}"
check_table "VenueCameraAccessLogTable" "rapid-cortex-venue-camera-access-log-${STAGE}"
check_table "VenueIncidentOverlaysTable" "rapid-cortex-venue-incident-overlays-${STAGE}"

echo ""

# ─── S3 bucket ────────────────────────────────────────────────────────────────
VENUE_BUCKET="rapid-cortex-venue-assets-${STAGE}-${ACCOUNT_ID}"
echo "S3 buckets:"
if aws s3api head-bucket --bucket "$VENUE_BUCKET" \
     --region "$REGION" >/dev/null 2>&1; then
  ok "S3 VenueAssetsBucket → $VENUE_BUCKET"
else
  fail "S3 VenueAssetsBucket → $VENUE_BUCKET (not found in AWS)"
fi

echo ""

# ─── Secrets Manager ─────────────────────────────────────────────────────────
RING_SECRET="rapid-cortex/connect/ring-credentials"
echo "Secrets Manager:"
if aws secretsmanager describe-secret --secret-id "$RING_SECRET" \
     --region "$REGION" --output text --query 'Name' \
     >/dev/null 2>&1; then
  ok "SecretsManager RingCredentialsSecret → $RING_SECRET"
else
  fail "SecretsManager RingCredentialsSecret → $RING_SECRET (not found in AWS)"
fi

echo ""

# ─── Check these resources are NOT already owned by the DataLayer stack ───────
ROOT_STACK="${ROOT_STACK_NAME:-rapid-cortex-dev}"
echo "Checking DataLayer stack resource ownership..."
NESTED_STACK_NAME="$(
  aws cloudformation describe-stack-resource \
    --stack-name "$ROOT_STACK" \
    --logical-resource-id DataLayerStack \
    --region "$REGION" \
    --query 'StackResourceDetail.PhysicalResourceId' \
    --output text 2>/dev/null || echo ""
)"

if [[ -z "$NESTED_STACK_NAME" || "$NESTED_STACK_NAME" == "None" ]]; then
  echo "  (warning: could not resolve DataLayerStack from $ROOT_STACK — skipping ownership check)"
else
  STACK_LOGICAL_IDS="$(
    aws cloudformation list-stack-resources \
      --stack-name "$NESTED_STACK_NAME" \
      --region "$REGION" \
      --query 'StackResourceSummaries[].LogicalResourceId' \
      --output text 2>/dev/null || echo ""
  )"
  for id in QRLocationsTable CampusConfigTable CampusIncidentsTable VenueConfigTable \
             VenueAssetsTable VenueFacilitiesTable ConnectRegistryTable ConnectEvidenceTable \
             ConnectAccessSessionsTable ConnectAccessLogTable PlatformNoticesTable \
             PlatformNoticeAcksTable VenueCameraAccessLogTable VenueIncidentOverlaysTable \
             VenueAssetsBucket RingCredentialsSecret; do
    if echo "$STACK_LOGICAL_IDS" | grep -qw "$id"; then
      echo "  ⚠ $id is already owned by the stack — remove from import manifest"
      FAILED=$((FAILED + 1))
    fi
  done
  echo "  ✓ Ownership check complete"
fi

echo ""

if (( FAILED > 0 )); then
  echo "=== $FAILED check(s) failed — fix before running import ==="
  echo "    If physical names differ, update resources-to-import-new.json manually."
  exit 1
fi

echo "=== All resources confirmed in AWS and not yet stack-owned ==="
echo ""
echo "resources-to-import-new.json content (16 new entries only):"
echo "---"

jq -n \
  --arg stage "$STAGE" \
  --arg account "$ACCOUNT_ID" \
  --arg ring "$RING_SECRET" \
  '[
    {"ResourceType":"AWS::DynamoDB::Table","LogicalResourceId":"QRLocationsTable",
     "ResourceIdentifier":{"TableName":("rapid-cortex-qr-locations-" + $stage)}},
    {"ResourceType":"AWS::DynamoDB::Table","LogicalResourceId":"CampusConfigTable",
     "ResourceIdentifier":{"TableName":("rapid-cortex-campus-config-" + $stage)}},
    {"ResourceType":"AWS::DynamoDB::Table","LogicalResourceId":"CampusIncidentsTable",
     "ResourceIdentifier":{"TableName":("rapid-cortex-campus-incidents-" + $stage)}},
    {"ResourceType":"AWS::DynamoDB::Table","LogicalResourceId":"VenueConfigTable",
     "ResourceIdentifier":{"TableName":("rapid-cortex-venue-config-" + $stage)}},
    {"ResourceType":"AWS::DynamoDB::Table","LogicalResourceId":"VenueAssetsTable",
     "ResourceIdentifier":{"TableName":("rapid-cortex-venue-assets-" + $stage)}},
    {"ResourceType":"AWS::DynamoDB::Table","LogicalResourceId":"VenueFacilitiesTable",
     "ResourceIdentifier":{"TableName":("rapid-cortex-venue-facilities-" + $stage)}},
    {"ResourceType":"AWS::DynamoDB::Table","LogicalResourceId":"ConnectRegistryTable",
     "ResourceIdentifier":{"TableName":("rapid-cortex-connect-registry-" + $stage)}},
    {"ResourceType":"AWS::DynamoDB::Table","LogicalResourceId":"ConnectEvidenceTable",
     "ResourceIdentifier":{"TableName":("rapid-cortex-connect-evidence-" + $stage)}},
    {"ResourceType":"AWS::DynamoDB::Table","LogicalResourceId":"ConnectAccessSessionsTable",
     "ResourceIdentifier":{"TableName":("rapid-cortex-connect-sessions-" + $stage)}},
    {"ResourceType":"AWS::DynamoDB::Table","LogicalResourceId":"ConnectAccessLogTable",
     "ResourceIdentifier":{"TableName":("rapid-cortex-connect-access-log-" + $stage)}},
    {"ResourceType":"AWS::DynamoDB::Table","LogicalResourceId":"PlatformNoticesTable",
     "ResourceIdentifier":{"TableName":("rapid-cortex-platform-notices-" + $stage)}},
    {"ResourceType":"AWS::DynamoDB::Table","LogicalResourceId":"PlatformNoticeAcksTable",
     "ResourceIdentifier":{"TableName":("rapid-cortex-platform-notice-acks-" + $stage)}},
    {"ResourceType":"AWS::DynamoDB::Table","LogicalResourceId":"VenueCameraAccessLogTable",
     "ResourceIdentifier":{"TableName":("rapid-cortex-venue-camera-access-log-" + $stage)}},
    {"ResourceType":"AWS::DynamoDB::Table","LogicalResourceId":"VenueIncidentOverlaysTable",
     "ResourceIdentifier":{"TableName":("rapid-cortex-venue-incident-overlays-" + $stage)}},
    {"ResourceType":"AWS::S3::Bucket","LogicalResourceId":"VenueAssetsBucket",
     "ResourceIdentifier":{"BucketName":("rapid-cortex-venue-assets-" + $stage + "-" + $account)}},
    {"ResourceType":"AWS::SecretsManager::Secret","LogicalResourceId":"RingCredentialsSecret",
     "ResourceIdentifier":{"Id":$ring}}
  ]'
