#!/bin/bash
# Fast Lex slot-type upsert + locale build (skips intent create/update).
set -euo pipefail
export AWS_PROFILE="${AWS_PROFILE:-rapid-cortex}"
export AWS_REGION="${AWS_REGION:-us-east-1}"
export BOT_ID="${BOT_ID:-IJIBJOJG2L}"
export BOT_LOCALE="${BOT_LOCALE:-en_US}"
export SLOT_TYPES_ONLY=true
export DRY_RUN="${DRY_RUN:-false}"

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
npx --yes tsx scripts/sync-lex-311-taxonomy.ts
