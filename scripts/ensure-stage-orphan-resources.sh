#!/usr/bin/env bash
# Create empty per-stage clones of DataLayer Existing* Dynamo tables and buckets.
# Usage:
#   bash scripts/ensure-stage-orphan-resources.sh staging
#   bash scripts/ensure-stage-orphan-resources.sh staging --dry-run
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck source=scripts/lib/rapid-cortex-aws.sh
source "${ROOT}/scripts/lib/rapid-cortex-aws.sh"
rapid_cortex_assert_aws_account

TARGET_STAGE="${1:-}"
shift || true
if [[ -z "${TARGET_STAGE}" || "${TARGET_STAGE}" == --* ]]; then
  echo "Usage: $0 <target-stage> [--dry-run] [--source-stage dev]" >&2
  exit 1
fi

exec python3 "${ROOT}/scripts/ensure-stage-orphan-resources.py" \
  --target-stage "${TARGET_STAGE}" \
  --region "${AWS_REGION:-${AWS_DEFAULT_REGION:-us-east-1}}" \
  "$@"
