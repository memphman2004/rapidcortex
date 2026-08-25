#!/usr/bin/env bash
set -euo pipefail
# Zip monorepo tree for S3→CodeBuild API/SAM deploy (no GitHub). Mirrors package-web-source.sh.
# Unlike the web package, no local vendor-pack prep is needed here — scripts/deploy.sh does
# that itself (rc_prepare_api_vendor_for_sam) once running inside CodeBuild.
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENVIRONMENT="${1:-dev}"

OUT_FINAL="${PACKAGE_API_SOURCE_OUT:-${ROOT}/api-source-${ENVIRONMENT}.zip}"
# Zip on local disk first — writing a large archive onto an external volume often stalls
# (same reasoning as scripts/package-web-source.sh).
OUT_TMP="${PACKAGE_API_SOURCE_TMP:-${TMPDIR:-/tmp}/api-source-${ENVIRONMENT}.$$.zip}"

echo "Packaging API/SAM build context for CodeBuild (${ENVIRONMENT}) → ${OUT_FINAL} (via ${OUT_TMP})"
rm -f "${OUT_TMP}" "${OUT_FINAL}"

(
  cd "$ROOT"
  set +f
  INCLUDES=(
    package.json package-lock.json tsconfig.base.json
    buildspec.api.yml
    infra
    scripts
    packages
    apps/api
  )
  for p in "${INCLUDES[@]}"; do
    if [[ ! -e "$p" ]]; then
      echo "ERROR: Missing path ${p}; run from monorepo root." >&2
      exit 1
    fi
  done

  zip -rq "${OUT_TMP}" "${INCLUDES[@]}" \
    -x '*/node_modules/*' \
    -x '*/*/.next/*' \
    -x '*/dist/*' \
    -x '*/coverage/*' \
    -x '*/.git/*' \
    -x '*/.aws-sam/*' \
    -x '*/.rapid-cortex-sam-build/*' \
    -x '*.log' \
    -x '*.dmg' \
    -x '*.exe' \
    -x '*.msi'
)

mv -f "${OUT_TMP}" "${OUT_FINAL}"
ls -lh "${OUT_FINAL}"
