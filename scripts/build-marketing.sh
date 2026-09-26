#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

echo "Building marketing static export..."
export NEXT_PUBLIC_APP_ORIGIN="${NEXT_PUBLIC_APP_ORIGIN:-https://app.rapidcortex.us}"
export NEXT_PUBLIC_SITE_URL="${NEXT_PUBLIC_SITE_URL:-https://www.nexcortiq.us}"
export NEXT_PUBLIC_MARKETING_SITE_URL="${NEXT_PUBLIC_MARKETING_SITE_URL:-${NEXT_PUBLIC_SITE_URL}}"
# Stack-4 public API for /connect/{nest,wyze} enroll.
export NEXT_PUBLIC_CONNECT_PUBLIC_BASE="${NEXT_PUBLIC_CONNECT_PUBLIC_BASE:-https://7c70vqd1p5.execute-api.us-east-1.amazonaws.com}"
# Keep static generation from thrashing the host (pairs with experimental.cpus in next.config).
export NODE_OPTIONS="${NODE_OPTIONS:---max-old-space-size=8192}"

cd apps/marketing
npm install --prefer-offline
npm run build

echo "Marketing build complete. Output in apps/marketing/out/"
