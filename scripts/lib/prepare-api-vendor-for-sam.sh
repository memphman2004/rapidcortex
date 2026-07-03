#!/usr/bin/env bash
# Refresh vendored workspace tarballs and wire apps/api for SAM / Lambda build.
#
# Call this before `npm run build -w rapid-cortex-api` on every API deploy path.
# It runs scripts/refresh-api-vendor-packs.sh (rebuild shared types → pack tgz → sync
# package-lock integrity) so Lambda never bundles stale rapid-cortex-shared/security types.
#
# Env:
#   ROOT                      — monorepo root (auto-detected when unset)
#   RC_API_PKG_BACKUP_SUFFIX  — backup suffix for apps/api/package.json (default: pre-sam)
set -euo pipefail

_prepare_api_vendor_root() {
  if [[ -z "${ROOT:-}" ]]; then
    ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
  fi
  export ROOT
}

# Rebuild + pack + lockfile integrity, then rewrite apps/api deps and reinstall.
rc_prepare_api_vendor_for_sam() {
  _prepare_api_vendor_root
  local backup_suffix="${RC_API_PKG_BACKUP_SUFFIX:-pre-sam}"
  local vendor_dir="${ROOT}/apps/api/vendor-packs"

  echo "── API vendor prep: scripts/refresh-api-vendor-packs.sh ──"
  bash "${ROOT}/scripts/refresh-api-vendor-packs.sh"

  echo "── Building rapid-cortex-protocols (API compile dependency) ──"
  npm run build -w rapid-cortex-protocols

  local t_shared t_int t_sec
  t_shared="$(ls -1 "${vendor_dir}"/rapid-cortex-shared-*.tgz 2>/dev/null | sort | tail -1)"
  t_int="$(ls -1 "${vendor_dir}"/rapid-cortex-integrations-*.tgz 2>/dev/null | sort | tail -1)"
  t_sec="$(ls -1 "${vendor_dir}"/rapid-cortex-security-*.tgz 2>/dev/null | sort | tail -1)"
  for f in "$t_shared" "$t_int" "$t_sec"; do
    if [[ -z "$f" || ! -f "$f" ]]; then
      echo "ERROR: missing vendor pack under ${vendor_dir} (refresh-api-vendor-packs.sh failed?)." >&2
      exit 1
    fi
  done
  T_SHARED="$(basename "$t_shared")"
  T_INT="$(basename "$t_int")"
  T_SEC="$(basename "$t_sec")"
  export T_SHARED T_INT T_SEC

  REVERT_API_PKG=0
  if [[ -f "${ROOT}/apps/api/package.json" ]]; then
    cp "${ROOT}/apps/api/package.json" "${ROOT}/apps/api/package.json.${backup_suffix}"
    REVERT_API_PKG=1
    export REVERT_API_PKG
    if ! command -v jq &>/dev/null; then
      echo "ERROR: jq required to rewrite apps/api/package.json for SAM (brew install jq)." >&2
      exit 1
    fi
    API_PKG_TMP="$(mktemp "${ROOT}/apps/api/package.json.tmp.XXXXXX")"
    if ! jq \
      --arg s "file:vendor-packs/${T_SHARED}" \
      --arg i "file:vendor-packs/${T_INT}" \
      --arg e "file:vendor-packs/${T_SEC}" \
      '.dependencies["rapid-cortex-shared"]=$s | .dependencies["rapid-cortex-integrations"]=$i | .dependencies["rapid-cortex-security"]=$e' \
      "${ROOT}/apps/api/package.json" > "${API_PKG_TMP}"; then
      rm -f "${API_PKG_TMP}"
      echo "ERROR: jq failed to rewrite apps/api/package.json for SAM vendor-packs." >&2
      exit 1
    fi
    if [[ ! -s "${API_PKG_TMP}" ]]; then
      rm -f "${API_PKG_TMP}"
      echo "ERROR: jq produced an empty rewrite for apps/api/package.json." >&2
      exit 1
    fi
    mv "${API_PKG_TMP}" "${ROOT}/apps/api/package.json"
  fi

  for _pkg_dir in apps/api/node_modules/rapid-cortex-shared apps/api/node_modules/rapid-cortex-integrations apps/api/node_modules/rapid-cortex-security; do
    if [[ -e "${ROOT}/${_pkg_dir}" ]]; then
      chmod -R u+w "${ROOT}/${_pkg_dir}" 2>/dev/null || true
      rm -rf "${ROOT}/${_pkg_dir}"
    fi
  done

  # Keep apps/api/package-lock.json — refresh-api-vendor-packs.sh updates tarball integrity.
  cd "${ROOT}/apps/api" && npm_config_prefer_offline=false npm install --no-workspaces && cd "${ROOT}"

  sync_vendor_dist() {
    local src="$1"
    local dest_root="$2"
    rm -rf "${dest_root}/dist"
    mkdir -p "${dest_root}"
    rsync -a "${src}/" "${dest_root}/dist/"
  }
  if [[ -d apps/api/node_modules/rapid-cortex-shared ]]; then
    sync_vendor_dist packages/shared/dist apps/api/node_modules/rapid-cortex-shared
  fi
  if [[ -d apps/api/node_modules/rapid-cortex-integrations ]]; then
    sync_vendor_dist packages/integrations/dist apps/api/node_modules/rapid-cortex-integrations
  fi
  if [[ -d apps/api/node_modules/rapid-cortex-security ]]; then
    sync_vendor_dist packages/security/dist apps/api/node_modules/rapid-cortex-security
  fi

  echo "── API vendor packs ready: ${T_SHARED}, ${T_INT}, ${T_SEC} ──"
}
