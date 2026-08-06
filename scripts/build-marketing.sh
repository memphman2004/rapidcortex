#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

echo "Building marketing static export..."
export NEXT_PUBLIC_APP_ORIGIN="${NEXT_PUBLIC_APP_ORIGIN:-https://app.rapidcortex.us}"
export NEXT_PUBLIC_SITE_URL="${NEXT_PUBLIC_SITE_URL:-https://www.rapidcortex.us}"
# Keep static generation from thrashing the host (pairs with experimental.cpus in next.config).
export NODE_OPTIONS="${NODE_OPTIONS:---max-old-space-size=8192}"

cd apps/marketing
npm install --prefer-offline
npm run build

echo "Marketing build complete. Output in apps/marketing/out/"
