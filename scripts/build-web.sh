#!/usr/bin/env bash
set -euo pipefail
# Local Next.js production build (optional). ECS production builds run in CodeBuild (see buildspec.web.yml).
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

echo "Building Rapid Cortex web app workspace…"
npm run build -w rapid-cortex-web
echo "✓ Web build complete"
