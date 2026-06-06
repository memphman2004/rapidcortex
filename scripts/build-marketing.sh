#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

echo "Building marketing static export..."
export NEXT_PUBLIC_APP_ORIGIN="${NEXT_PUBLIC_APP_ORIGIN:-https://app.rapidcortex.us}"
export NEXT_PUBLIC_SITE_URL="${NEXT_PUBLIC_SITE_URL:-https://www.rapidcortex.us}"

cd apps/marketing
npm install --prefer-offline
npm run build

echo "Marketing build complete. Output in apps/marketing/out/"
