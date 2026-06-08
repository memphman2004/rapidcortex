#!/usr/bin/env bash
# Local pre-deploy checks for apps/marketing/out (no AWS required).
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck source=scripts/lib/static-s3-hosting.sh
source "${ROOT}/scripts/lib/static-s3-hosting.sh"

STATIC_DIR="${STATIC_DIR:-${ROOT}/apps/marketing/out}"
REQUIRED_ROUTES=(enter demo pricing)

if [[ ! -f "${STATIC_DIR}/index.html" ]]; then
  echo "ERROR: ${STATIC_DIR}/index.html not found. Run: npm run build:marketing" >&2
  exit 1
fi

static_s3_verify_local_css_refs "${STATIC_DIR}"
static_s3_verify_local_extensionless_routes "${STATIC_DIR}" "${REQUIRED_ROUTES[@]}"

echo "Marketing static output OK (${STATIC_DIR})."
