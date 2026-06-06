#!/usr/bin/env bash
set -euo pipefail
# Publish installers + merged latest.json consumed by desktops at:
#   https://downloads.rapidcortex.us/latest.json
#
# macOS distribution: prefer scripts/macos-distribution-build.sh (or publish-macos-dmg.sh) before upload
# so the .dmg is Developer ID signed + notarized + stapled. Windows: Authenticode (EV preferred) for .exe.
#
# Optional: RUN_MAC_DISTRIBUTION_BUILD_BEFORE_UPLOAD=1 with APPLE_DEVELOPER_ID, APPLE_TEAM_ID, APPLE_ID,
# APPLE_APP_PASSWORD rebuilds/re-signs the DMG at FILE_PATH before checksum + S3 (CI convenience).
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

ENVIRONMENT="${1:?Usage: $0 <env> <platform: mac|windows> <file-path> <version>}"
PLATFORM="${2:?}"
FILE_PATH="${3:?}"
VERSION="${4:?}"

AWS_REGION="${AWS_REGION:-${AWS_DEFAULT_REGION:-us-east-1}}"
STACK_NAME="${DOWNLOADS_STACK_NAME:-rapid-cortex-downloads-${ENVIRONMENT}}"
DOWNLOAD_BASE="${DOWNLOADS_PUBLIC_BASE_URL:-https://downloads.rapidcortex.us}"
DOWNLOAD_BASE="${DOWNLOAD_BASE%/}"
RELEASE_NOTES_BASE="${RELEASE_NOTES_BASE_URL:-https://rapidcortex.us/releases}"

MAC_MIN_OS="${MAC_MIN_OS_VERSION:-11.0}"
WIN_MIN_OS="${WIN_MIN_OS_VERSION:-10.0}"

MAC_URL="$DOWNLOAD_BASE/mac/latest/RapidCortex.dmg"
WIN_URL="$DOWNLOAD_BASE/windows/latest/RapidCortexSetup.exe"

if ! command -v jq &>/dev/null; then
  echo "❌ jq is required (brew install jq)." >&2
  exit 1
fi

if [[ "${PLATFORM}" == "mac" && "${RUN_MAC_DISTRIBUTION_BUILD_BEFORE_UPLOAD:-0}" == "1" ]]; then
  if [[ -z "${APPLE_DEVELOPER_ID:-}" || -z "${APPLE_TEAM_ID:-}" || -z "${APPLE_ID:-}" || -z "${APPLE_APP_PASSWORD:-}" ]]; then
    echo "❌ RUN_MAC_DISTRIBUTION_BUILD_BEFORE_UPLOAD=1 requires APPLE_DEVELOPER_ID, APPLE_TEAM_ID, APPLE_ID, APPLE_APP_PASSWORD." >&2
    exit 1
  fi
  export OUTPUT_DIR="$(cd "$(dirname "$FILE_PATH")" && pwd)"
  export DMG_FILENAME="$(basename "$FILE_PATH")"
  echo "→ macOS: building signed + notarized DMG at ${FILE_PATH} …"
  "$ROOT/scripts/macos-distribution-build.sh"
fi

if [[ ! -f "${FILE_PATH}" ]]; then
  echo "❌ File not found: ${FILE_PATH}" >&2
  exit 1
fi

if command -v shasum &>/dev/null; then
  CHECKSUM="$(shasum -a 256 "${FILE_PATH}" | awk '{print $1}')"
elif command -v sha256sum &>/dev/null; then
  CHECKSUM="$(sha256sum "${FILE_PATH}" | awk '{print $1}')"
else
  echo "❌ Need shasum (macOS) or sha256sum (Linux)." >&2
  exit 1
fi

BUCKET="$(
  aws cloudformation describe-stacks \
    --stack-name "${STACK_NAME}" \
    --query 'Stacks[0].Outputs[?OutputKey==`DownloadsBucketName`].OutputValue' \
    --output text \
    --region "${AWS_REGION}" 2>/dev/null || true
)"

if [[ -z "${BUCKET}" || "${BUCKET}" == "None" ]]; then
  echo "❌ Stack ${STACK_NAME} missing DownloadsBucketName; deploy infra/downloads-hosting.yaml." >&2
  exit 1
fi

if [[ "${PLATFORM}" == "mac" ]]; then
  FILENAME="RapidCortex.dmg"
elif [[ "${PLATFORM}" == "windows" ]]; then
  FILENAME="RapidCortexSetup.exe"
else
  echo "❌ platform must be mac or windows" >&2
  exit 1
fi

RELEASE_DATE="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
RUN_UPDATED="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
RELEASE_NOTES="${RELEASE_NOTES_BASE%/}/${PLATFORM}/${VERSION}"

echo "Uploading ${PLATFORM} v${VERSION} (sha256 ${CHECKSUM:0:12}…) → s3://${BUCKET} …"
aws s3 cp "${FILE_PATH}" "s3://${BUCKET}/${PLATFORM}/releases/${VERSION}/${FILENAME}" --region "${AWS_REGION}"
aws s3 cp "${FILE_PATH}" "s3://${BUCKET}/${PLATFORM}/latest/${FILENAME}" --region "${AWS_REGION}"

TMP_CUR="$(mktemp)"
cleanup() {
  rm -f "${TMP_CUR}" "${TMP_CUR}.out"
}
trap cleanup EXIT

if ! aws s3 cp "s3://${BUCKET}/latest.json" "${TMP_CUR}" --region "${AWS_REGION}" 2>/dev/null; then
  echo '{}' >"${TMP_CUR}"
fi

BACKUP_TS="$(date -u +"%Y%m%dT%H%M%SZ")"
BACKUP_KEY="latest.json.bak/${BACKUP_TS}.json"
if aws s3 cp "s3://${BUCKET}/latest.json" "s3://${BUCKET}/${BACKUP_KEY}" --region "${AWS_REGION}" 2>/dev/null; then
  echo "✓ Previous latest.json backed up to s3://${BUCKET}/${BACKUP_KEY}"
else
  echo "ℹ️  No prior latest.json to back up (first publish or empty bucket path)."
fi

jq \
  --arg ver "$VERSION" \
  --arg plat "$PLATFORM" \
  --arg sum "$CHECKSUM" \
  --arg rd "$RELEASE_DATE" \
  --arg run "$RUN_UPDATED" \
  --arg mac_u "$MAC_URL" \
  --arg win_u "$WIN_URL" \
  --arg rn "$RELEASE_NOTES" \
  --arg macMin "$MAC_MIN_OS" \
  --arg winMin "$WIN_MIN_OS" \
  '
    . as $in
    | ($in.mac // {version:"", url:$mac_u, sha256:"", releaseDate:null, releaseNotes:"", minOSVersion:$macMin}) as $mc
    | ($in.windows // {version:"", url:$win_u, sha256:"", releaseDate:null, releaseNotes:"", minOSVersion:$winMin}) as $wc
    | (if $plat == "mac" then
          {
            mac: {version:$ver, url:$mac_u, sha256:$sum, releaseDate:$rd, releaseNotes:$rn, minOSVersion:$macMin},
            windows: $wc
          }
        else
          {
            mac: $mc,
            windows: {version:$ver, url:$win_u, sha256:$sum, releaseDate:$rd, releaseNotes:$rn, minOSVersion:$winMin}
          }
        end)
    | .updatedAt = $run
  ' "${TMP_CUR}" >"${TMP_CUR}.out"

aws s3 cp "${TMP_CUR}.out" "s3://${BUCKET}/latest.json" \
  --region "${AWS_REGION}" \
  --content-type "application/json; charset=utf-8" \
  --cache-control "max-age=60"

echo "✓ latest.json merged at s3://${BUCKET}/latest.json"

CF_DIST_ID="$(
  aws cloudformation describe-stacks \
    --stack-name "${STACK_NAME}" \
    --query 'Stacks[0].Outputs[?OutputKey==`CloudFrontDistributionId`].OutputValue | [0]' \
    --output text \
    --region "${AWS_REGION}" 2>/dev/null || true
)"

if [[ -z "${CF_DIST_ID}" || "${CF_DIST_ID}" == "None" ]]; then
  CF_DIST_ID="$(
    aws cloudformation describe-stacks \
      --stack-name "${STACK_NAME}" \
      --query 'Stacks[0].Outputs[?OutputKey==`DistributionId`].OutputValue | [0]' \
      --output text \
      --region "${AWS_REGION}" 2>/dev/null || true
  )"
fi

if [[ -n "${CF_DIST_ID}" && "${CF_DIST_ID}" != "None" ]]; then
  INVALIDATION_ID="$(
    aws cloudfront create-invalidation \
      --distribution-id "${CF_DIST_ID}" \
      --paths "/latest.json" \
      --query 'Invalidation.Id' \
      --output text \
      2>/dev/null || true
  )"
  echo "✓ CloudFront invalidation submitted for /latest.json (id=${INVALIDATION_ID:-unknown})"
else
  echo "⚠️  CloudFront distribution id not found in stack outputs; CDN may serve stale latest.json until TTL expires."
  echo "    TODO(prod): ensure infra/downloads-hosting exports CloudFrontDistributionId or DistributionId."
fi

echo "  $MAC_URL"
echo "  $WIN_URL"
echo "  $DOWNLOAD_BASE/latest.json"
