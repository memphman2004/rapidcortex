#!/usr/bin/env bash
# Rebuild workspace packages, pack SAM vendor tarballs, and sync package-lock integrity.
# CodeBuild runs `npm ci` against file:apps/api/vendor-packs/*.tgz entries in package-lock.json.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

VENDOR_DIR="apps/api/vendor-packs"
LOCKFILES=(
  "${ROOT}/package-lock.json"
  "${ROOT}/apps/api/package-lock.json"
)

npm run build -w rapid-cortex-shared -w rapid-cortex-integrations -w rapid-cortex-security

mkdir -p "$VENDOR_DIR"
pack_tgz() {
  local pkg_dir="$ROOT/$1"
  local out
  out="$(cd "$pkg_dir" && npm pack --pack-destination "$ROOT/$VENDOR_DIR" 2>/dev/null | tail -1)"
  basename "$out"
}

T_SHARED="$(pack_tgz packages/shared)"
T_INT="$(pack_tgz packages/integrations)"
T_SEC="$(pack_tgz packages/security)"

node - "${LOCKFILES[@]}" <<'NODE'
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const root = process.cwd();
const vendorDir = path.join(root, "apps/api/vendor-packs");
const lockPaths = process.argv.slice(2);
const resolvedVariants = (name) => [
  `file:apps/api/vendor-packs/${name}`,
  `file:vendor-packs/${name}`,
];

let totalUpdated = 0;
for (const lockPath of lockPaths) {
  const lock = JSON.parse(fs.readFileSync(lockPath, "utf8"));
  let updated = 0;
  for (const name of fs.readdirSync(vendorDir)) {
    if (!name.endsWith(".tgz")) continue;
    const filePath = path.join(vendorDir, name);
    const integrity =
      "sha512-" + crypto.createHash("sha512").update(fs.readFileSync(filePath)).digest("base64");
    for (const resolved of resolvedVariants(name)) {
      for (const pkg of Object.values(lock.packages ?? {})) {
        if (pkg && pkg.resolved === resolved) {
          pkg.integrity = integrity;
          updated += 1;
          console.log(`${path.basename(lockPath)}: ${name} -> ${resolved}`);
        }
      }
    }
  }
  if (updated === 0) {
    console.warn(`warn: no integrity entries updated in ${lockPath}`);
  }
  fs.writeFileSync(lockPath, `${JSON.stringify(lock, null, 2)}\n`);
  totalUpdated += updated;
}
if (totalUpdated === 0) process.exit(1);
NODE

echo "Vendor packs refreshed: ${T_SHARED}, ${T_INT}, ${T_SEC}"
