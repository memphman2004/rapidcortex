#!/usr/bin/env bash
# Back-compat shim — provisions the rcsuperadmin principal.
# For the full RC staff set (rcsuperadmin + rcadmin + rcitadmin) use:
#   npm run seed:rc-staff
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec npx tsx "${ROOT}/onboard/employee/provision-rc-staff.ts"
