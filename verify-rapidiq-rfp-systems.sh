#!/usr/bin/env bash
# Repo-root wrapper so this works as documented:
#   STAGE=staging bash verify-rapidiq-rfp-systems.sh
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec bash "${ROOT}/scripts/verify-rapidiq-rfp-systems.sh" "$@"
