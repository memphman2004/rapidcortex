#!/usr/bin/env bash
# Measures Rapid Cortex SAM templates and fails when any single template is nearing CloudFormation SAM
# transformed-template limits (~1 MiB). Intended as a deploy preflight.
#
# Env:
#   SKIP_SAM_BUILD_FOR_SIZE=1 — only measure raw infra/*.yaml sizes (no transformed fragment).
#   SKIP_APP_SAM_SIZE_PROXY=1 — warn instead of fail when built AppSam* nested YAML exceeds the /5 proxy (try deploy; CFN is arbiter).
#   RC_SAM_BUILD_DIR=/path/to/sam/build — reuse an existing sam build dir (skips redundant sam build when set).
#   RC_ROOT_TEMPLATE_FILE=infra/template2.yaml — SAM build root (default infra/template.yaml).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

RC_ROOT_TEMPLATE_FILE="${RC_ROOT_TEMPLATE_FILE:-infra/template.yaml}"

FAIL_REASONS=()
WARN_REASONS=()
RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
RESET='\033[0m'

# CloudFormation fails SAM changesets when the transformed fragment exceeds ~1,000,000 bytes.
# Important: that limit applies to the *macro output* (fully expanded Serverless → CFN), which is
# typically much larger than the built nested YAML on disk (often ~5–7×). A ~187KiB built
# AppSamStack/template.yaml can still exceed 1MiB and fail at deploy (see rapid-cortex-dev).
WARN_BYTES=$((850 * 1024))
FAIL_BYTES=$((900 * 1024))
# Built nested App SAM: fail if disk size exceeds ~1MiB/5 (conservative proxy for CFN SAM transform fragment).
# Divisor 4.88 targets ~205KiB on-disk built nested YAML (stack-app-sam-2 post-hospital-split ~205KiB).
# Divisor 5 (~200KiB) blocked deploy at ~216KiB before hospital routes moved to AppSamHospitalStack2.
SAM_TRANSFORM_FRAGMENT_BYTES=$((1000 * 1000))
SAM_BUILT_APP_STACK_PROXY_LIMIT=$((SAM_TRANSFORM_FRAGMENT_BYTES * 10 / 49))
WARN_RESOURCE_COUNT=400

count_top_level_resources() {
  local f="$1"
  if ! grep -q "^Resources:\\s*" "$f"; then
    echo "0"
    return 0
  fi
  awk '
    /^Resources:/{r=1;next}
    r && /^Outputs:/{exit}
    r && /^  [A-Za-z][A-Za-z0-9]*:$/{c++}
    END {print c+0}
  ' "$f"
}

echo "=== Rapid Cortex template size check ==="

raw_root="$(wc -c < "${RC_ROOT_TEMPLATE_FILE}" | tr -d ' ')"
echo "Root template ${RC_ROOT_TEMPLATE_FILE} (bytes on disk): $raw_root"

if [[ "$raw_root" -ge "$WARN_BYTES" ]]; then
  WARN_REASONS+=("Raw root template infra/template.yaml is ${raw_root} B (warn >= ${WARN_BYTES} B).")
fi
if [[ "$raw_root" -ge "$FAIL_BYTES" ]]; then
  FAIL_REASONS+=("Raw root ${RC_ROOT_TEMPLATE_FILE} (${raw_root} B) exceeds fail threshold ${FAIL_BYTES} B.")
fi

root_res="$(count_top_level_resources "${RC_ROOT_TEMPLATE_FILE}")"
echo "Top-level Resources in ${RC_ROOT_TEMPLATE_FILE} (logical resources): ${root_res}"
if [[ "${root_res:-0}" -ge "${WARN_RESOURCE_COUNT}" ]]; then
  WARN_REASONS+=("${RC_ROOT_TEMPLATE_FILE} has ${root_res} top-level resources (warn threshold ${WARN_RESOURCE_COUNT}). Prefer further nested stacks if this grows.")
fi

for f in infra/nested/*.yaml; do
  [[ -f "$f" ]] || continue
  b="$(wc -c < "$f" | tr -d ' ')"
  bn="$(basename "$f")"
  echo "Nested template ${bn} (bytes on disk): $b"
  if [[ "$b" -ge "$WARN_BYTES" ]]; then
    WARN_REASONS+=("Raw nested ${bn} is ${b} B (warn >= ${WARN_BYTES} B).")
  fi
  if [[ "$b" -ge "$FAIL_BYTES" ]]; then
    FAIL_REASONS+=("Raw nested ${bn} (${b} B) exceeds fail threshold ${FAIL_BYTES} B.")
  fi
  rc="$(count_top_level_resources "$f")"
  echo "  └─ top-level Resources: ${rc}"
  if [[ "${rc:-0}" -ge "${WARN_RESOURCE_COUNT}" ]]; then
    WARN_REASONS+=("${bn} has ${rc} logical resources (warn threshold ${WARN_RESOURCE_COUNT}). Split further if needed.")
  fi
done

sam_build=""
temp_sam_build=0
if [[ -n "${SKIP_SAM_BUILD_FOR_SIZE:-}" ]]; then
  echo "SKIP_SAM_BUILD_FOR_SIZE set — skipping sam build / built-template measurement."
elif [[ -n "${RC_SAM_BUILD_DIR:-}" && -f "${RC_SAM_BUILD_DIR}/template.yaml" ]]; then
  sam_build="${RC_SAM_BUILD_DIR}"
  echo "Using existing SAM build dir: ${sam_build}"
else
  if ! command -v sam &>/dev/null; then
    WARN_REASONS+=("sam CLI not found; cannot measure built/transformed template sizes.")
  else
    sam_build="$(mktemp -d "${TMPDIR:-/tmp}/rc-size-sam-build.XXXXXX")"
    temp_sam_build=1
    echo "Running: sam build --template-file ${RC_ROOT_TEMPLATE_FILE} ..."
    sam build --template-file "${RC_ROOT_TEMPLATE_FILE}" --build-dir "${sam_build}" >/dev/null
    echo "SAM build complete (temp dir ${sam_build})."
  fi
fi

if [[ -n "${sam_build}" && -f "${sam_build}/template.yaml" ]]; then
  built_tpl="${sam_build}/template.yaml"
  built_sz="$(wc -c < "${built_tpl}" | tr -d ' ')"
  echo "SAM built root template (${built_tpl}, bytes on disk): $built_sz"
  if [[ "$built_sz" -ge "$WARN_BYTES" ]]; then
    WARN_REASONS+=("SAM built root template is ${built_sz} B (warn threshold ${WARN_BYTES} B).")
  fi
  if [[ "$built_sz" -ge "$FAIL_BYTES" ]]; then
    FAIL_REASONS+=("SAM built root template (${built_sz} B) exceeds fail threshold ${FAIL_BYTES} B.")
  fi
  br="$(count_top_level_resources "${built_tpl}")"
  echo "SAM built root top-level Resources: ${br}"
  if [[ "${br:-0}" -ge "${WARN_RESOURCE_COUNT}" ]]; then
    WARN_REASONS+=("Built root has ${br} top-level resources (warn >= ${WARN_RESOURCE_COUNT}).")
  fi

  echo "SAM synthesized CloudFormation snippets (excluding node_modules):"
  while IFS= read -r -d '' nf; do
    nb="$(wc -c < "${nf}" | tr -d ' ')"
    rel="${nf#${sam_build}/}"
    echo "  ${rel}: ${nb} bytes"
    if [[ "${nf}" == "${built_tpl}" ]]; then
      continue
    fi
    ny="$(count_top_level_resources "${nf}")"
    echo "      top-level Resources: ${ny}"
    if [[ "$nb" -ge "$FAIL_BYTES" ]]; then
      FAIL_REASONS+=("Built artifact ${rel} (${nb} B) exceeds fail threshold ${FAIL_BYTES} B.")
    elif [[ "${rel}" == "AppSamStack/template.yaml" || "${rel}" == "AppSamStackV2/template.yaml" || "${rel}" == "AppSamStack2/template.yaml" || "${rel}" == "AppSamStack4/template.yaml" || "${rel}" == "AppSamHospitalStack2/template.yaml" || "${rel}" == "AppSamDeceptionStack2/template.yaml" || "${rel}" == "AppSamRealtimeStack2/template.yaml" ]] && [[ "$nb" -ge "${SAM_BUILT_APP_STACK_PROXY_LIMIT}" ]]; then
      proxy_msg="Built ${rel} is ${nb} B (>= ${SAM_BUILT_APP_STACK_PROXY_LIMIT} B, ~${SAM_TRANSFORM_FRAGMENT_BYTES}/5 proxy for CFN SAM transform ${SAM_TRANSFORM_FRAGMENT_BYTES} B fragment). Deploy can FAIL even when this YAML is <1MiB. Split stack-app-sam (e.g. second nested stack with HttpApiId) or shrink Serverless/IAM expansion."
      if [[ -n "${SKIP_APP_SAM_SIZE_PROXY:-}" ]]; then
        WARN_REASONS+=("${proxy_msg} SKIP_APP_SAM_SIZE_PROXY set — proceeding to deploy; CFN SAM transform is the arbiter.")
      else
        FAIL_REASONS+=("${proxy_msg}")
      fi
    elif [[ "$nb" -ge "$WARN_BYTES" ]]; then
      WARN_REASONS+=("Built artifact ${rel} is ${nb} B (warn >= ${WARN_BYTES} B).")
    fi
    if [[ "${ny:-0}" -ge "${WARN_RESOURCE_COUNT}" ]]; then
      WARN_REASONS+=("Built ${rel} has ${ny} resources (warn >= ${WARN_RESOURCE_COUNT}). Split stacks if nearing CFN limits.")
    fi
  done < <(find "${sam_build}" \( -path "*/node_modules/*" \) -prune -o -type f \( -name '*.yaml' -o -name '*.yml' \) \
    ! -path "*/node_modules/*" -print0 2>/dev/null || true)
fi

if [[ "${temp_sam_build}" -eq 1 && -n "${sam_build:-}" ]]; then
  rm -rf "${sam_build}"
fi

echo ""
set +u
for w in "${WARN_REASONS[@]}"; do
  echo -e "${YELLOW}WARN:${RESET} $w"
done
set -u

if [[ "${#FAIL_REASONS[@]}" -gt 0 ]]; then
  for fe in "${FAIL_REASONS[@]}"; do
    echo -e "${RED}FAIL:${RESET} $fe"
  done
  echo ""
  echo -e "${RED}RESULT: FAIL${RESET}"
  exit 1
fi

echo -e "${GREEN}RESULT: PASS${RESET} (warnings may appear above)"
