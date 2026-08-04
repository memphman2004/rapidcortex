#!/usr/bin/env bash
# Alias — canonical script is scripts/deploy-hiring-api.sh
set -euo pipefail
exec "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/deploy-hiring-api.sh" "$@"
