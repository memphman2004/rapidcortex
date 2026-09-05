#!/usr/bin/env bash
# Upload docs/onboarding-packets/{vertical}/ to s3://$AssetsBucket/onboarding-packets/{vertical}/
set -euo pipefail

STAGE="${1:-}"
if [[ -z "$STAGE" ]]; then
  echo "Usage: bash scripts/sync-onboarding-packets-s3.sh {dev|staging|pilot|prod}" >&2
  exit 1
fi

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="${ROOT}/docs/onboarding-packets"
if [[ ! -d "$SRC" ]]; then
  echo "Missing ${SRC}" >&2
  exit 1
fi

STACK="rapid-cortex-data-${STAGE}"
BUCKET="$(aws cloudformation describe-stacks --stack-name "$STACK" \
  --query "Stacks[0].Outputs[?OutputKey=='AssetsBucket'].OutputValue" \
  --output text 2>/dev/null || true)"
if [[ -z "$BUCKET" || "$BUCKET" == "None" ]]; then
  STACK="rapid-cortex-${STAGE}"
  BUCKET="$(aws cloudformation describe-stacks --stack-name "$STACK" \
    --query "Stacks[0].Outputs[?contains(OutputKey, 'AssetsBucket')].OutputValue | [0]" \
    --output text)"
fi
if [[ -z "$BUCKET" || "$BUCKET" == "None" ]]; then
  echo "Could not resolve AssetsBucket for stage ${STAGE}" >&2
  exit 1
fi

echo "Syncing ${SRC} → s3://${BUCKET}/onboarding-packets/"
for vertical in campus venue hospital transit psap; do
  dir="${SRC}/${vertical}"
  if [[ ! -d "$dir" ]]; then
    echo "Skip ${vertical} (no local folder yet)"
    continue
  fi
  aws s3 sync "$dir" "s3://${BUCKET}/onboarding-packets/${vertical}/" \
    --exclude ".DS_Store" --exclude "README.md"
done
echo "Done. Open RC Admin → Onboarding packets to verify."
