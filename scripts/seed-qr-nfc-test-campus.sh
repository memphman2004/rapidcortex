#!/usr/bin/env bash
# Seed a test QR/NFC code for test-campus-uga after AppSamQrStack deploy.
# Usage: bash scripts/seed-qr-nfc-test-campus.sh
set -euo pipefail

STAGE="${DEPLOYMENT_STAGE:-dev}"
REGION="${AWS_REGION:-us-east-1}"
TABLE="${QR_NFC_CODES_TABLE:-rapid-cortex-qr-nfc-codes-${STAGE}}"
AGENCY_ID="${AGENCY_ID:-test-campus-uga}"
AGENCY_NAME="${AGENCY_NAME:-Test Campus UGA}"
APP_BASE="${APP_PUBLIC_BASE_URL:-https://app.rapidcortex.us}"
NOW="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

# Generate Crockford Base32 ULID (26 chars) without extra deps
QR_ID="$(python3 - <<'PY'
import os, time, random
ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"
t = int(time.time() * 1000)
rand = int.from_bytes(os.urandom(10), "big")
# 48-bit time + 80-bit random ≈ ULID layout (good enough for dev seed)
time_part = ""
for _ in range(10):
    time_part = ALPHABET[t % 32] + time_part
    t //= 32
rand_part = ""
for _ in range(16):
    rand_part = ALPHABET[rand % 32] + rand_part
    rand //= 32
print((time_part + rand_part)[:26])
PY
)"

URL="${APP_BASE%/}/report/${QR_ID}"

aws dynamodb put-item \
  --table-name "$TABLE" \
  --item "{
    \"agencyId\":       {\"S\": \"${AGENCY_ID}\"},
    \"qrId\":           {\"S\": \"${QR_ID}\"},
    \"agencyName\":     {\"S\": \"${AGENCY_NAME}\"},
    \"name\":           {\"S\": \"Main campus reporting QR\"},
    \"vertical\":       {\"S\": \"campus\"},
    \"reportType\":     {\"S\": \"both\"},
    \"nfcEnabled\":     {\"BOOL\": false},
    \"active\":         {\"BOOL\": true},
    \"url\":            {\"S\": \"${URL}\"},
    \"scanCount\":      {\"N\": \"0\"},
    \"nfcTapCount\":    {\"N\": \"0\"},
    \"totalEngagements\": {\"N\": \"0\"},
    \"createdBy\":      {\"S\": \"ops-seed\"},
    \"createdByRole\":  {\"S\": \"ops-seed\"},
    \"createdAt\":      {\"S\": \"${NOW}\"},
    \"updatedAt\":      {\"S\": \"${NOW}\"}
  }" \
  --region "$REGION"

echo "Seeded QR code for ${AGENCY_ID}"
echo "  qrId: ${QR_ID}"
echo "  URL:  ${URL}"
