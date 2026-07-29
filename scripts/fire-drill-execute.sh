#!/usr/bin/env bash
# G5 — Operational kill-switch / rollback drill with timed evidence (dev/staging).
# Performs safe, reversible checks only: smoke + writeback-disabled probe + flag documentation.
# Does NOT redeploy or mutate CloudFormation unless RC_FIRE_DRILL_ALLOW_MUTATIONS=1 (reserved).
#
# Smoke failures are recorded but do not abort the drill — writeback / flag evidence still runs.
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

STAGE="${1:-dev}"
REGION="${2:-us-east-1}"
OUT_DIR="${RC_EVIDENCE_DIR:-/tmp/p0-gates}"
mkdir -p "${OUT_DIR}"
STAMP="$(date -u '+%Y-%m-%dT%H:%M:%SZ')"
LOG="${OUT_DIR}/g5-fire-drill-${STAMP}.log"

exec > >(tee -a "${LOG}") 2>&1

echo "=========================================="
echo "G5 fire drill — ${STAMP}"
echo "stage=${STAGE} region=${REGION}"
echo "SMOKE_WEB_STACK_NAME=${SMOKE_WEB_STACK_NAME:-<(default resolve)>}"
echo "=========================================="

t0=$(date +%s)
DRILL_OK=1

echo ""
echo "== 1) Baseline smoke =="
set +e
bash scripts/post-deploy-smoke.sh "${STAGE}" "${REGION}"
SMOKE1=$?
set -e
echo "baseline_smoke_exit=${SMOKE1}"
if [[ "${SMOKE1}" -ne 0 ]]; then
  echo "WARN: baseline smoke failed (continuing drill for writeback/flag evidence)"
  DRILL_OK=0
fi

echo ""
echo "== 2) CAD write-back hard gate (must stay disabled) =="
API_URL="$(aws cloudformation describe-stacks \
  --stack-name "rapid-cortex-${STAGE}" \
  --region "${REGION}" \
  --query 'Stacks[0].Outputs[?OutputKey==`HttpApiUrl`].OutputValue' \
  --output text 2>/dev/null || true)"
API_URL="${API_URL:-https://k26yw4o3xk.execute-api.us-east-1.amazonaws.com}"
API_URL="${API_URL%/}"

set +e
code=$(curl -sS -o "${OUT_DIR}/g5-writeback-probe-body.txt" -w "%{http_code}" \
  -X POST "${API_URL}/api/cad/incidents" \
  -H 'content-type: application/json' \
  -d '{"agencyId":"test-agency"}' || echo "000")
set -e
echo "POST ${API_URL}/api/cad/incidents → HTTP ${code}"
echo "(Expect 401 without JWT, or 403/disabled when authenticated — never a successful CAD write.)"
head -c 500 "${OUT_DIR}/g5-writeback-probe-body.txt" 2>/dev/null || true
echo ""
# 2xx would mean a successful CAD write path — fail the drill.
if [[ "${code}" =~ ^2 ]]; then
  echo "FAIL: writeback probe returned HTTP ${code} (unexpected success)"
  DRILL_OK=0
fi

echo ""
echo "== 3) Kill-switch documentation (feature flags) =="
echo "CAD_WRITEBACK_ENABLED must remain unset/false in Lambda env and CFN CadWritebackEnabled=false."
aws cloudformation describe-stacks \
  --stack-name "rapid-cortex-${STAGE}" \
  --region "${REGION}" \
  --query 'Stacks[0].Parameters[?contains(ParameterKey, `Cad`) || contains(ParameterKey, `Waf`) || contains(ParameterKey, `Write`)].[ParameterKey,ParameterValue]' \
  --output text 2>/dev/null || echo "(parameter query skipped)"

echo ""
echo "== 4) Post-drill smoke =="
set +e
bash scripts/post-deploy-smoke.sh "${STAGE}" "${REGION}"
SMOKE2=$?
set -e
echo "post_drill_smoke_exit=${SMOKE2}"
if [[ "${SMOKE2}" -ne 0 ]]; then
  echo "WARN: post-drill smoke failed"
  DRILL_OK=0
fi

t1=$(date +%s)
echo ""
echo "=========================================="
echo "G5 drill complete in $((t1 - t0))s"
echo "drill_ok=${DRILL_OK} baseline_smoke=${SMOKE1} post_smoke=${SMOKE2} writeback_http=${code}"
echo "Log: ${LOG}"
echo "Attach this log to docs/evidence/<date>/g5-operational-safety.md"
echo "=========================================="
if [[ "${DRILL_OK}" -eq 1 ]]; then
  exit 0
fi
exit 1
