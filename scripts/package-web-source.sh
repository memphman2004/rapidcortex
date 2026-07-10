#!/usr/bin/env bash
set -euo pipefail
# Zip monorepo tree for S3→CodeBuild (no GitHub). Excludes bulky artifacts locally and in CI.
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENVIRONMENT="${1:-dev}"

OUT="${PACKAGE_WEB_SOURCE_OUT:-${ROOT}/web-source-${ENVIRONMENT}.zip}"
  echo "Packaging web build context for CodeBuild (${ENVIRONMENT}) → ${OUT}"
  # Changes every package so Docker COPY layers cannot reuse a stale apps/ tree.
  date -u +"%Y-%m-%dT%H:%M:%SZ" > "${ROOT}/.web-docker-cache-bust"
# shellcheck source=scripts/lib/api-vendor-lock.sh
source "${ROOT}/scripts/lib/api-vendor-lock.sh"
rc_wait_for_api_vendor_lock
"${ROOT}/scripts/refresh-api-vendor-packs.sh"
rm -f "${OUT}"

(
  cd "$ROOT"
  set +f
  INCLUDES=(
    package.json package-lock.json tsconfig.base.json
    .web-docker-cache-bust
    Dockerfile.web buildspec.web.yml .dockerignore
    scripts/verify-host-routing.sh
    packages
    apps
  )
  for p in "${INCLUDES[@]}"; do
    if [[ ! -e "$p" ]]; then
      echo "ERROR: Missing path ${p}; run from monorepo root." >&2
      exit 1
    fi
  done

  # Do not exclude apps/api/vendor-packs/*.tgz — workspace lockfile uses file: entries for npm ci in Docker.
  zip -rq "${OUT}" "${INCLUDES[@]}" \
    -x '*/node_modules/*' \
    -x '*/*/.next/*' \
    -x '*/dist/*' \
    -x '*/coverage/*' \
    -x '*/.git/*' \
    -x '*.log' \
    -x '*.dmg' \
    -x '*.exe' \
    -x '*.msi'
)

ls -lh "${OUT}"
