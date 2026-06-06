#!/usr/bin/env bash
set -euo pipefail
# Static apex/www marketing bucket + CloudFront (us-east-1). See infra/web-hosting-template.yaml.
STAGE="${1:-prod}"

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

case "${STAGE}" in
dev | staging | prod | pilot) ;;
*)
  echo "Invalid stage: ${STAGE}" >&2
  exit 1
  ;;
esac

export DEPLOYMENT_STAGE="${STAGE}"
exec "${ROOT}/scripts/deploy-web-hosting.sh"
