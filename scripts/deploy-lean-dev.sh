#!/usr/bin/env bash
# Lean dev deploy: build + update selected nested stacks only (skips full root SAM deploy).
#
# Usage:
#   source scripts/env-api-dev.sh
#   ./scripts/deploy-lean-dev.sh [dev] [--sam1-only|--sam3-only|--qr-only|--sam4-only|--sam5-only]
#
# Env (optional):
#   LEAN_DEPLOY_STACKS=sam1,sam3,qr,sam4,sam5   default qr + sam5
#   ROUTE53_HOSTED_ZONE_ID       when set, passed to AppSam4 deploy (api4.rapidcortex.us ACM + alias)
#   SAM_BUILD_DIR                default /Volumes/Mac Mini/.sam-lean-build (or repo .sam-lean-build)
#   SAM_BUILD_USE_CACHE=0        default 0 (fresh build, no stale rsync cache)
#   SAM_PARALLEL=1               default 1
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

STAGE="dev"
DEPLOY_SAM1=0
DEPLOY_SAM3=0
DEPLOY_QR=0
DEPLOY_SAM4=0
DEPLOY_SAM5=0
LEAN_STACKS="${LEAN_DEPLOY_STACKS:-qr,sam5}"
if [[ -n "${LEAN_STACKS}" ]]; then
  DEPLOY_SAM1=0
  DEPLOY_SAM3=0
  DEPLOY_QR=0
  DEPLOY_SAM4=0
  DEPLOY_SAM5=0
  IFS=',' read -ra _LEAN_PARTS <<< "${LEAN_STACKS}"
  for _part in "${_LEAN_PARTS[@]}"; do
    case "${_part// /}" in
      sam1) DEPLOY_SAM1=1 ;;
      sam3) DEPLOY_SAM3=1 ;;
      qr) DEPLOY_QR=1 ;;
      sam4) DEPLOY_SAM4=1 ;;
      sam5) DEPLOY_SAM5=1 ;;
      *)
        echo "Unknown LEAN_DEPLOY_STACKS entry: ${_part} (use sam1, sam3, qr, sam4, sam5)" >&2
        exit 1
        ;;
    esac
  done
fi
for arg in "$@"; do
  case "$arg" in
    dev | staging | prod | pilot) STAGE="$arg" ;;
    --sam1-only) DEPLOY_SAM1=1; DEPLOY_SAM3=0; DEPLOY_QR=0; DEPLOY_SAM4=0; DEPLOY_SAM5=0 ;;
    --sam3-only) DEPLOY_SAM1=0; DEPLOY_SAM3=1; DEPLOY_QR=0; DEPLOY_SAM4=0; DEPLOY_SAM5=0 ;;
    --qr-only) DEPLOY_SAM1=0; DEPLOY_SAM3=0; DEPLOY_QR=1; DEPLOY_SAM4=0; DEPLOY_SAM5=0 ;;
    --sam4-only) DEPLOY_SAM1=0; DEPLOY_SAM3=0; DEPLOY_QR=0; DEPLOY_SAM4=1; DEPLOY_SAM5=0 ;;
    --sam5-only) DEPLOY_SAM1=0; DEPLOY_SAM3=0; DEPLOY_QR=0; DEPLOY_SAM4=0; DEPLOY_SAM5=1 ;;
    *)
      echo "Unknown argument: $arg" >&2
      echo "Usage: $0 [dev] [--sam1-only|--sam3-only|--qr-only|--sam4-only|--sam5-only]" >&2
      exit 1
      ;;
  esac
done
if [[ "${DEPLOY_SAM1}" -eq 0 && "${DEPLOY_SAM3}" -eq 0 && "${DEPLOY_QR}" -eq 0 && "${DEPLOY_SAM4}" -eq 0 && "${DEPLOY_SAM5}" -eq 0 ]]; then
  echo "ERROR: no nested stack selected (use --sam1-only, --sam3-only, --sam4-only, --qr-only, --sam5-only, or LEAN_DEPLOY_STACKS)" >&2
  exit 1
fi

APP_NAME="${APP_NAME:-rapid-cortex}"
STACK_NAME="${STACK_NAME:-${APP_NAME}-${STAGE}}"
AWS_REGION="${AWS_REGION:-us-east-1}"
export AWS_REGION AWS_DEFAULT_REGION="${AWS_DEFAULT_REGION:-$AWS_REGION}"

SAM_BUILD_USE_CACHE="${SAM_BUILD_USE_CACHE:-0}"
SAM_PARALLEL="${SAM_PARALLEL:-1}"
SAM_BUILD_IN_SOURCE="${SAM_BUILD_IN_SOURCE:-1}"
NODE_OPTIONS="${NODE_OPTIONS:---max-old-space-size=8192}"
export NODE_OPTIONS

if [[ -n "${SAM_BUILD_DIR:-}" ]]; then
  mkdir -p "${SAM_BUILD_DIR}"
else
  SAM_BUILD_DIR="/Volumes/Mac Mini/.sam-lean-build"
  if [[ ! -d "/Volumes/Mac Mini" ]]; then
    SAM_BUILD_DIR="${ROOT}/.sam-lean-build"
  fi
  mkdir -p "${SAM_BUILD_DIR}"
fi
export SAM_BUILD_DIR

echo "═══════════════════════════════════════════════════════"
echo " Rapid Cortex LEAN nested-stack deploy"
echo "═══════════════════════════════════════════════════════"
echo " Stage:               ${STAGE}"
echo " Root stack:          ${STACK_NAME}"
echo " SAM1 stack:          $([[ "${DEPLOY_SAM1}" -eq 1 ]] && echo yes || echo no)"
echo " SAM3 stack:          $([[ "${DEPLOY_SAM3}" -eq 1 ]] && echo yes || echo no)"
echo " QR stack:            $([[ "${DEPLOY_QR}" -eq 1 ]] && echo yes || echo no)"
echo " SAM4 stack:          $([[ "${DEPLOY_SAM4}" -eq 1 ]] && echo yes || echo no)"
echo " SAM5 stack:          $([[ "${DEPLOY_SAM5}" -eq 1 ]] && echo yes || echo no)"
echo " SAM_BUILD_DIR:       ${SAM_BUILD_DIR}"
echo " SAM_BUILD_USE_CACHE: ${SAM_BUILD_USE_CACHE}"
echo " SAM_PARALLEL:        ${SAM_PARALLEL}"
echo "═══════════════════════════════════════════════════════"

if [[ "${DEPLOY_SAM1}" -eq 1 ]]; then
  sam validate --lint --template-file "${ROOT}/infra/nested/stack-app-sam.yaml"
fi
if [[ "${DEPLOY_SAM3}" -eq 1 ]]; then
  sam validate --lint --template-file "${ROOT}/infra/nested/stack-app-sam-3.yaml"
fi
if [[ "${DEPLOY_QR}" -eq 1 ]]; then
  sam validate --lint --template-file "${ROOT}/infra/nested/stack-app-sam-qr.yaml"
fi
if [[ "${DEPLOY_SAM4}" -eq 1 ]]; then
  sam validate --lint --template-file "${ROOT}/infra/nested/stack-app-sam-4.yaml"
fi
if [[ "${DEPLOY_SAM5}" -eq 1 ]]; then
  sam validate --lint --template-file "${ROOT}/infra/nested/stack-app-sam-5.yaml"
fi

# --- Vendor prep (same as deploy.sh) — exclusive lock vs web packaging ---
# shellcheck source=scripts/lib/api-vendor-lock.sh
source "${ROOT}/scripts/lib/api-vendor-lock.sh"
rc_acquire_api_vendor_lock

npm install
npm run build -w rapid-cortex-shared
npm run build -w rapid-cortex-protocols
npm run build -w rapid-cortex-integrations
npm run build -w rapid-cortex-security
VENDOR_DIR="apps/api/vendor-packs"
mkdir -p "$VENDOR_DIR"
pack_tgz() {
  local pkg_dir="$ROOT/$1"
  local out
  out="$(cd "$pkg_dir" && npm pack --pack-destination "$ROOT/$VENDOR_DIR" 2>/dev/null | tail -1)"
  echo "$(basename "$out")"
}
T_SHARED="$(pack_tgz packages/shared)"
T_INT="$(pack_tgz packages/integrations)"
T_SEC="$(pack_tgz packages/security)"
REVERT_API_PKG=0
if [[ -f "${ROOT}/apps/api/package.json" ]]; then
  cp "${ROOT}/apps/api/package.json" "${ROOT}/apps/api/package.json.pre-lean"
  REVERT_API_PKG=1
  if ! command -v jq &>/dev/null; then
    echo "ERROR: jq required (brew install jq)" >&2
    exit 1
  fi
  API_PKG_TMP="$(mktemp "${ROOT}/apps/api/package.json.tmp.XXXXXX")"
  jq \
    --arg s "file:vendor-packs/${T_SHARED}" \
    --arg i "file:vendor-packs/${T_INT}" \
    --arg e "file:vendor-packs/${T_SEC}" \
    '.dependencies["rapid-cortex-shared"]=$s | .dependencies["rapid-cortex-integrations"]=$i | .dependencies["rapid-cortex-security"]=$e' \
    "${ROOT}/apps/api/package.json" > "${API_PKG_TMP}"
  mv "${API_PKG_TMP}" "${ROOT}/apps/api/package.json"
fi
for _pkg_dir in apps/api/node_modules/rapid-cortex-shared apps/api/node_modules/rapid-cortex-integrations apps/api/node_modules/rapid-cortex-security; do
  if [[ -e "$_pkg_dir" ]]; then
    chmod -R u+w "$_pkg_dir" 2>/dev/null || true
    rm -rf "$_pkg_dir"
  fi
done
rm -f apps/api/package-lock.json
cd apps/api && npm install --no-workspaces && cd "$ROOT"
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
npm run build -w rapid-cortex-api

restore_api_pkg() {
  if [[ "$REVERT_API_PKG" -eq 1 ]]; then
    if [[ -f "${ROOT}/apps/api/package.json.pre-lean" ]]; then
      mv "${ROOT}/apps/api/package.json.pre-lean" "${ROOT}/apps/api/package.json"
    elif git -C "${ROOT}" diff --quiet -- apps/api/package.json 2>/dev/null; then
      :
    else
      git -C "${ROOT}" checkout HEAD -- apps/api/package.json 2>/dev/null || true
    fi
  fi
}
trap restore_api_pkg EXIT

nested_stack_name() {
  local logical="$1"
  aws cloudformation describe-stack-resources \
    --stack-name "${STACK_NAME}" \
    --region "${AWS_REGION}" \
    --query "StackResources[?LogicalResourceId=='${logical}'].PhysicalResourceId" \
    --output text | awk -F/ '{print $(NF-1)}'
}

nested_params_override() {
  local nested="$1"
  aws cloudformation describe-stacks \
    --stack-name "${nested}" \
    --region "${AWS_REGION}" \
    --query 'Stacks[0].Parameters[*].[ParameterKey,ParameterValue]' \
    --output text | awk 'NF >= 2 && $2 != "" {printf "%s=%s ", $1, $2}'
}

lean_sam_build() {
  local template="$1"
  local label="$2"
  local build_dir="${SAM_BUILD_DIR}/${label}"
  mkdir -p "${build_dir}"
  local cli=(sam build --template-file "${template}" --build-dir "${build_dir}")
  if [[ "${SAM_BUILD_USE_CACHE}" == "1" ]]; then
    cli+=(--cached)
  else
    cli+=(--no-cached)
  fi
  if [[ "${SAM_PARALLEL}" == "1" ]]; then
    cli+=(--parallel)
  fi
  if [[ "${SAM_BUILD_IN_SOURCE}" == "1" ]]; then
    cli+=(--build-in-source)
  fi
  echo "sam build → ${build_dir}" >&2
  "${cli[@]}"
}

lean_sam_deploy_nested() {
  local built_template="$1"
  local nested_stack="$2"
  shift 2
  if [[ ! -f "${built_template}" ]]; then
    echo "ERROR: Built template not found: ${built_template}" >&2
    exit 1
  fi
  local params
  params="$(nested_params_override "${nested_stack}")"
  params="${params} $*"
  echo "sam deploy → ${nested_stack}" >&2
  echo "  template: ${built_template}" >&2
  # shellcheck disable=SC2086
  sam deploy \
    --template-file "${built_template}" \
    --stack-name "${nested_stack}" \
    --capabilities CAPABILITY_IAM CAPABILITY_NAMED_IAM CAPABILITY_AUTO_EXPAND \
    --parameter-overrides ${params} \
    --resolve-s3 \
    --no-confirm-changeset \
    --no-fail-on-empty-changeset \
    --region "${AWS_REGION}"
}

if [[ "${DEPLOY_SAM1}" -eq 1 ]]; then
  SAM1_STACK="$(nested_stack_name AppSamStackV2)"
  if [[ -z "${SAM1_STACK}" || "${SAM1_STACK}" == "None" ]]; then
    echo "ERROR: AppSamStackV2 not found under ${STACK_NAME}" >&2
    exit 1
  fi
  echo ""
  echo "▶ AppSamStackV2 (${SAM1_STACK})"
  lean_sam_build "${ROOT}/infra/nested/stack-app-sam.yaml" "sam1"
  lean_sam_deploy_nested "${SAM_BUILD_DIR}/sam1/template.yaml" "${SAM1_STACK}"
  echo "✅ AppSamStackV2 deploy complete"
fi

if [[ "${DEPLOY_SAM3}" -eq 1 ]]; then
  SAM3_STACK="$(nested_stack_name AppSam3Stack)"
  if [[ -z "${SAM3_STACK}" || "${SAM3_STACK}" == "None" ]]; then
    echo "ERROR: AppSam3Stack not found under ${STACK_NAME}" >&2
    exit 1
  fi
  echo ""
  echo "▶ AppSam3Stack (${SAM3_STACK})"
  lean_sam_build "${ROOT}/infra/nested/stack-app-sam-3.yaml" "sam3"
  lean_sam_deploy_nested "${SAM_BUILD_DIR}/sam3/template.yaml" "${SAM3_STACK}"
  echo "✅ AppSam3Stack deploy complete"
fi

if [[ "${DEPLOY_QR}" -eq 1 ]]; then
  QR_STACK="$(nested_stack_name AppSamQrStack)"
  if [[ -z "${QR_STACK}" || "${QR_STACK}" == "None" ]]; then
    echo "ERROR: AppSamQrStack not found under ${STACK_NAME}" >&2
    exit 1
  fi
  echo ""
  echo "▶ AppSamQrStack (${QR_STACK})"
  lean_sam_build "${ROOT}/infra/nested/stack-app-sam-qr.yaml" "qr"
  lean_sam_deploy_nested "${SAM_BUILD_DIR}/qr/template.yaml" "${QR_STACK}"
  echo "✅ AppSamQrStack deploy complete"
fi

if [[ "${DEPLOY_SAM4}" -eq 1 ]]; then
  SAM4_STACK="$(nested_stack_name AppSam4Stack)"
  if [[ -z "${SAM4_STACK}" || "${SAM4_STACK}" == "None" ]]; then
    echo "ERROR: AppSam4Stack not found under ${STACK_NAME}" >&2
    exit 1
  fi
  echo ""
  echo "▶ AppSam4Stack (${SAM4_STACK})"
  # SAM4_LEAN_BUILD skips node_modules rsync per-function; deps ship via NodeDepsLayer instead.
  SAM4_LEAN_BUILD=1 lean_sam_build "${ROOT}/infra/nested/stack-app-sam-4.yaml" "sam4"
  _sam4_extra=()
  if [[ -n "${ROUTE53_HOSTED_ZONE_ID:-}" ]]; then
    _sam4_extra+=("Route53HostedZoneId=${ROUTE53_HOSTED_ZONE_ID}")
    echo "  api4 DNS: Route53HostedZoneId=${ROUTE53_HOSTED_ZONE_ID} → api4.rapidcortex.us"
  fi
  lean_sam_deploy_nested "${SAM_BUILD_DIR}/sam4/template.yaml" "${SAM4_STACK}" ${_sam4_extra[@]:+"${_sam4_extra[@]}"}
  echo "✅ AppSam4Stack deploy complete"
fi

if [[ "${DEPLOY_SAM5}" -eq 1 ]]; then
  SAM5_STACK="$(nested_stack_name AppSam5Stack)"
  if [[ -z "${SAM5_STACK}" || "${SAM5_STACK}" == "None" ]]; then
    echo "ERROR: AppSam5Stack not found under ${STACK_NAME}" >&2
    exit 1
  fi
  echo ""
  echo "▶ AppSam5Stack (${SAM5_STACK})"
  lean_sam_build "${ROOT}/infra/nested/stack-app-sam-5.yaml" "sam5"
  lean_sam_deploy_nested "${SAM_BUILD_DIR}/sam5/template.yaml" "${SAM5_STACK}"
  echo "✅ AppSam5Stack deploy complete"
fi

echo ""
echo "✅ Lean deploy finished (SAM1=${DEPLOY_SAM1}, SAM3=${DEPLOY_SAM3}, QR=${DEPLOY_QR}, SAM4=${DEPLOY_SAM4}, SAM5=${DEPLOY_SAM5})."
echo "   Verify LocationIntakeFunction env:"
echo "   aws lambda get-function-configuration --function-name \$(aws cloudformation describe-stack-resources --stack-name ${STACK_NAME} --query \"StackResources[?contains(LogicalResourceId,'LocationIntake')].PhysicalResourceId\" --output text | head -1 | xargs basename) --query Environment.Variables"
