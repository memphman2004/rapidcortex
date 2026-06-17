#!/usr/bin/env bash
# Seed campus + venue org config and RCLI locations for live UGA/MBS tenants.
# Usage: bash scripts/seed-prod-vertical-orgs.sh
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
STAGE="${DEPLOYMENT_STAGE:-dev}"
REGION="${AWS_REGION:-us-east-1}"

export CAMPUS_CONFIG_TABLE="${CAMPUS_CONFIG_TABLE:-rapid-cortex-campus-config-${STAGE}}"
export VENUE_CONFIG_TABLE="${VENUE_CONFIG_TABLE:-rapid-cortex-venue-config-${STAGE}}"
export QR_LOCATIONS_TABLE="${QR_LOCATIONS_TABLE:-rapid-cortex-qr-locations-${STAGE}}"

echo "Seeding campus config (UGA) → ${CAMPUS_CONFIG_TABLE}"
CAMPUS_CONFIG_TABLE="${CAMPUS_CONFIG_TABLE}" npx tsx "${ROOT}/apps/api/src/scripts/seed-campus-test-agency.ts" UGA

echo "Seeding venue config (MBS) → ${VENUE_CONFIG_TABLE}"
VENUE_CONFIG_TABLE="${VENUE_CONFIG_TABLE}" npx tsx "${ROOT}/scripts/seed-venue-config-mbs.ts"

echo "Seeding RCLI locations → ${QR_LOCATIONS_TABLE}"
QR_LOCATIONS_TABLE="${QR_LOCATIONS_TABLE}" npx tsx "${ROOT}/scripts/seed-prod-rcli-uga-mbs.ts"

echo "Done. Verify:"
echo "  Campus QR admin: https://app.rapidcortex.us/app/campus/UGA/qr-codes"
echo "  Venue QR admin:  https://app.rapidcortex.us/venue/MBS/qr-codes"
