#!/usr/bin/env bash
# Publish an in-account ffmpeg Lambda layer for Rapid Vision live captions.
#
# Usage:
#   AWS_PROFILE=rapid-cortex bash scripts/publish-ffmpeg-layer.sh
#
# Then redeploy (or set FFMPEG_LAYER_ARN) so stack-app-sam-6 attaches the layer
# and sets VISION_TRANSCRIPT_MOCK=false.
set -euo pipefail

REGION="${AWS_REGION:-us-east-1}"
LAYER_NAME="${FFMPEG_LAYER_NAME:-rapid-cortex-ffmpeg}"
WORKDIR="${TMPDIR:-/tmp}/rapid-cortex-ffmpeg-layer-$$"
# Static amd64 build used by many Lambda ffmpeg layers (johnvansickle).
FFMPEG_URL="${FFMPEG_STATIC_URL:-https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-amd64-static.tar.xz}"

cleanup() { rm -rf "${WORKDIR}"; }
trap cleanup EXIT

mkdir -p "${WORKDIR}/bin"
echo "Downloading static ffmpeg…" >&2
curl -fsSL "${FFMPEG_URL}" -o "${WORKDIR}/ffmpeg.tar.xz"
tar -xJf "${WORKDIR}/ffmpeg.tar.xz" -C "${WORKDIR}"
FFMPEG_BIN="$(find "${WORKDIR}" -type f -name ffmpeg | head -n 1)"
if [[ -z "${FFMPEG_BIN}" || ! -x "${FFMPEG_BIN}" ]]; then
  echo "ERROR: ffmpeg binary not found in archive" >&2
  exit 1
fi
# Lambda layers expose /opt; place binary at /opt/bin/ffmpeg
mkdir -p "${WORKDIR}/layer/bin"
cp "${FFMPEG_BIN}" "${WORKDIR}/layer/bin/ffmpeg"
chmod 755 "${WORKDIR}/layer/bin/ffmpeg"
(
  cd "${WORKDIR}/layer"
  zip -qr "${WORKDIR}/layer.zip" bin
)

echo "Publishing layer ${LAYER_NAME} in ${REGION}…" >&2
ARN="$(
  aws lambda publish-layer-version \
    --layer-name "${LAYER_NAME}" \
    --description "Static ffmpeg for Rapid Vision HLS transcript worker" \
    --zip-file "fileb://${WORKDIR}/layer.zip" \
    --compatible-runtimes python3.11 nodejs20.x \
    --compatible-architectures x86_64 \
    --region "${REGION}" \
    --query LayerVersionArn \
    --output text
)"

echo ""
echo "Published: ${ARN}"
echo "Export for deploy:"
echo "  export FFMPEG_LAYER_ARN=${ARN}"
echo "Or source scripts/env-api-dev.sh (defaults to the account layer) and redeploy."
