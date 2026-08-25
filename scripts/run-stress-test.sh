#!/usr/bin/env bash
set -euo pipefail

#
# Rapid Cortex — full stress test run: k6 profiles + report generation.
#
# Usage:
#   API_BASE=https://<api-host> WEB_BASE=https://<web-host> \
#     BEARER_TOKEN=eyJ... \
#     bash scripts/run-stress-test.sh staging
#
#   RC_SKIP_SOAK=1 bash scripts/run-stress-test.sh staging   # skip the ~22min soak profile
#
# This repo has no fixed staging/dev hostnames (they vary per deploy — see
# scripts/env-api-dev.sh), so API_BASE and WEB_BASE must be set explicitly.
#
# Profiles run in order: smoke, ramp, load, stress, spike, [soak]
# Each profile's k6 summary + HTML/JSON report is archived under
# results/<profile>/ so later profiles don't clobber earlier ones.
#
# Safety: stress/spike/soak profiles are refused against a prod host unless
# RC_ALLOW_PROD_STRESS=1 is set (mirrors the isProdHost() guard in
# scripts/perf/stress-test.ts).
#

ENVIRONMENT="${1:?Usage: $0 [dev|staging|prod]}"
case "$ENVIRONMENT" in
  dev | staging | prod) ;;
  *)
    echo "Invalid environment: ${ENVIRONMENT} (use dev|staging|prod)" >&2
    exit 2
    ;;
esac

API_BASE="${API_BASE:-${RC_API_BASE:-}}"
WEB_BASE="${WEB_BASE:-${RC_WEB_BASE:-}}"
BEARER_TOKEN="${BEARER_TOKEN:-${RC_BEARER:-${STRESS_BEARER_TOKEN:-}}}"

: "${API_BASE:?API_BASE or RC_API_BASE must be set, e.g. API_BASE=https://api.example.rapidcortex.us}"
: "${WEB_BASE:?WEB_BASE or RC_WEB_BASE must be set, e.g. WEB_BASE=https://app.example.rapidcortex.us}"

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RESULTS_DIR="${ROOT}/results"
K6_SCRIPT="${ROOT}/scripts/perf/rc-stress-test.js"
REPORT_SCRIPT="${ROOT}/scripts/generate-stress-report.ts"

cd "$ROOT"

command -v k6 >/dev/null 2>&1 || {
  echo "k6 not found on PATH. Install with: brew install k6" >&2
  exit 2
}

is_prod_host() {
  case "$1" in
    *app.rapidcortex.us* | *api.rapidcortex.us* | *www.rapidcortex.us* | *.cloudfront.net*) return 0 ;;
    *) return 1 ;;
  esac
}

PROFILES=(smoke ramp load stress spike)
if [[ -n "${RC_PROFILE:-}" ]]; then
  PROFILES=("$RC_PROFILE")
elif [[ "${RC_SKIP_SOAK:-0}" != "1" ]]; then
  PROFILES+=(soak)
fi

if is_prod_host "$API_BASE" || is_prod_host "$WEB_BASE"; then
  if [[ "${RC_ALLOW_PROD_STRESS:-0}" != "1" ]]; then
    echo "Refusing to run stress/spike/soak profiles against a prod host (${API_BASE} / ${WEB_BASE})." >&2
    echo "Set RC_ALLOW_PROD_STRESS=1 to override, or point API_BASE/WEB_BASE at staging." >&2
    FILTERED=()
    for p in "${PROFILES[@]}"; do
      case "$p" in
        stress | spike | soak) continue ;;
        *) FILTERED+=("$p") ;;
      esac
    done
    PROFILES=("${FILTERED[@]}")
  fi
fi

mkdir -p "$RESULTS_DIR"

OVERALL_PASS=1
SUMMARY_LINES=()

for profile in "${PROFILES[@]}"; do
  echo ""
  echo "════════════════════════════════════════════════════════"
  echo " Running profile: ${profile} (${ENVIRONMENT})"
  echo "════════════════════════════════════════════════════════"

  profile_dir="${RESULTS_DIR}/${profile}"
  mkdir -p "$profile_dir"
  rm -f "${RESULTS_DIR}/k6-summary.json"

  set +e
  LOAD_PROFILE="$profile" API_BASE="$API_BASE" WEB_BASE="$WEB_BASE" BEARER_TOKEN="${BEARER_TOKEN:-}" \
    ALLOW_WRITES="${STRESS_ALLOW_WRITES:-${ALLOW_WRITES:-0}}" \
    k6 run --out "json=${profile_dir}/k6-raw.json" "$K6_SCRIPT"
  k6_status=$?
  set -e

  if [[ ! -f "${RESULTS_DIR}/k6-summary.json" ]]; then
    echo "No summary produced for ${profile} (k6 exit ${k6_status}) — skipping report." >&2
    OVERALL_PASS=0
    SUMMARY_LINES+=("${profile}: NO SUMMARY (k6 exit ${k6_status})")
    continue
  fi

  mv "${RESULTS_DIR}/k6-summary.json" "${profile_dir}/k6-summary.json"

  set +e
  npx tsx "$REPORT_SCRIPT" --input "${profile_dir}/k6-summary.json" --out "$profile_dir"
  report_status=$?
  set -e

  if [[ $report_status -ne 0 ]]; then
    OVERALL_PASS=0
    SUMMARY_LINES+=("${profile}: FAIL (see ${profile_dir}/stress-report.html)")
  else
    SUMMARY_LINES+=("${profile}: PASS")
  fi
done

echo ""
echo "════════════════════════════════════════════════════════"
echo " Rapid Cortex — stress test run complete (${ENVIRONMENT})"
echo "════════════════════════════════════════════════════════"
for line in "${SUMMARY_LINES[@]}"; do
  echo " ${line}"
done
echo "════════════════════════════════════════════════════════"

[[ $OVERALL_PASS -eq 1 ]]
