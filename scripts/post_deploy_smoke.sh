#!/usr/bin/env bash
# DEPRECATED: use scripts/post-deploy-smoke.sh (hyphenated). Kept for CI/docs compatibility.
# Will be removed after external callers are audited.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
exec bash "${ROOT}/scripts/post-deploy-smoke.sh" "$@"
