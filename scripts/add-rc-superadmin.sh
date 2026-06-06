#!/usr/bin/env bash
# Back-compat wrapper — full pool migration lives in migrate-cognito-roles.sh
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec "${SCRIPT_DIR}/migrate-cognito-roles.sh"
