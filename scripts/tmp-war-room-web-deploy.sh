#!/usr/bin/env bash
set -euo pipefail
export AWS_PROFILE=rapid-cortex AWS_REGION=us-east-1 AWS_DEFAULT_REGION=us-east-1
unset HTTP_PROXY HTTPS_PROXY http_proxy https_proxy ALL_PROXY all_proxy
cd "$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
set -a
# shellcheck disable=SC1091
source scripts/env-web-ssr-prod.sh
set +a
# shellcheck disable=SC1091
source scripts/lib/resolve-mapbox-token.sh
resolve_mapbox_token
bash scripts/deploy-web-prod.sh
