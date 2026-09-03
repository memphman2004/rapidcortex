#!/usr/bin/env bash
# Seed Hoover Valley Transit (test-transit-hvt) agency + fleet tables.
# Usage: bash scripts/seed-transit-agencies.sh
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
export DEPLOYMENT_STAGE="${DEPLOYMENT_STAGE:-dev}"
export AWS_REGION="${AWS_REGION:-us-east-1}"
export TRANSIT_TEST_AGENCY_ID="${TRANSIT_TEST_AGENCY_ID:-test-transit-hvt}"
cd "$ROOT"
npx tsx apps/api/src/scripts/seed-transit-test-agency.ts
echo "Seed complete. Login with TRANSIT_* Cognito groups on ${TRANSIT_TEST_AGENCY_ID}."
