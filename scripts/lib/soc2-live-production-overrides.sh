#!/usr/bin/env bash
# Live production (DeploymentStage=dev / rapid-cortex-dev / app.rapidcortex.us)
# SOC 2 lock-in for SAM parameters.
#
# Sourced by scripts/deploy.sh when STAGE=dev. Safe to source from tests
# (no AWS calls).
#
# Does:
#   - Force DynamoPointInTimeRecovery=true (DDB_ENABLE_PITR)
#   - Block CAD_WRITEBACK_ENABLED=true
#   - Block ENABLE_CLOUD_TRAIL=true unless SOC2_CREATE_SAM_CLOUDTRAIL=1
#     (SAM would create rapid-cortex-audit-dev + Object Lock COMPLIANCE bucket)
#
# Does not:
#   - Force ENABLE_API_WAF=true (regional ACL is inventory-only; live WAF is CloudFront)
#   - Rename the stack
#   - Rotate secrets
#
# Override library — not a Type II report.

rc_soc2_apply_live_production_overrides() {
  local skip="${SOC2_SKIP_LIVE_OVERRIDES:-0}"
  if [[ "${skip}" == "1" ]]; then
    echo "ERROR: SOC2_SKIP_LIVE_OVERRIDES=1 is not allowed on live production (DeploymentStage=dev)." >&2
    echo "  PITR must stay on. Unset SOC2_SKIP_LIVE_OVERRIDES." >&2
    return 1
  fi

  if [[ "${CAD_WRITEBACK_ENABLED:-}" == "true" || "${CAD_WRITEBACK_ENABLED:-}" == "1" ]]; then
    echo "ERROR: CAD_WRITEBACK_ENABLED=true is not allowed on live production (DeploymentStage=dev)." >&2
    echo "  CAD write-back stays fail-closed until pilot go/no-go and a signed addendum." >&2
    return 1
  fi
  export CAD_WRITEBACK_ENABLED=false

  if [[ "${ENABLE_CLOUD_TRAIL:-}" == "true" && "${SOC2_CREATE_SAM_CLOUDTRAIL:-}" != "1" ]]; then
    echo "ERROR: ENABLE_CLOUD_TRAIL=true on deploy.sh dev would CREATE SAM trail rapid-cortex-audit-dev" >&2
    echo "  and bucket rapid-cortex-cloudtrail-logs-dev-<account> with Object Lock COMPLIANCE (2555 days)." >&2
    echo "  Live logging is Option B: trail rapid-cortex-cloudtrail-prod (EnableCloudTrail=false in SAM)." >&2
    echo "  Unset ENABLE_CLOUD_TRAIL, or set SOC2_CREATE_SAM_CLOUDTRAIL=1 only with change control." >&2
    return 1
  fi
  if [[ "${SOC2_CREATE_SAM_CLOUDTRAIL:-}" != "1" ]]; then
    export ENABLE_CLOUD_TRAIL=false
  fi

  if [[ -n "${DDB_ENABLE_PITR:-}" && "${DDB_ENABLE_PITR}" != "true" ]]; then
    echo "WARN: overriding DDB_ENABLE_PITR=${DDB_ENABLE_PITR} → true (SOC 2 live lock-in)." >&2
  fi
  export DDB_ENABLE_PITR=true

  echo "SOC2 live overrides: DDB_ENABLE_PITR=${DDB_ENABLE_PITR} ENABLE_CLOUD_TRAIL=${ENABLE_CLOUD_TRAIL} CAD_WRITEBACK_ENABLED=${CAD_WRITEBACK_ENABLED}"
}

# When executed directly, run the function (and optional --self-test).
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
  set -euo pipefail
  if [[ "${1:-}" == "--self-test" ]]; then
    fail=0
    # PITR forced
    unset DDB_ENABLE_PITR ENABLE_CLOUD_TRAIL CAD_WRITEBACK_ENABLED SOC2_CREATE_SAM_CLOUDTRAIL SOC2_SKIP_LIVE_OVERRIDES
    rc_soc2_apply_live_production_overrides >/tmp/soc2-ov-1.txt
    grep -q 'DDB_ENABLE_PITR=true' /tmp/soc2-ov-1.txt || fail=1
    [[ "${DDB_ENABLE_PITR}" == "true" ]] || fail=1
    [[ "${ENABLE_CLOUD_TRAIL}" == "false" ]] || fail=1
    [[ "${CAD_WRITEBACK_ENABLED}" == "false" ]] || fail=1

    # CAD write-back rejected
    unset DDB_ENABLE_PITR
    export CAD_WRITEBACK_ENABLED=true
    if rc_soc2_apply_live_production_overrides >/tmp/soc2-ov-2.txt 2>/tmp/soc2-ov-2.err; then
      echo "FAIL: CAD write-back should be rejected" >&2
      fail=1
    fi

    # CloudTrail create rejected
    export CAD_WRITEBACK_ENABLED=false
    export ENABLE_CLOUD_TRAIL=true
    unset SOC2_CREATE_SAM_CLOUDTRAIL
    if rc_soc2_apply_live_production_overrides >/tmp/soc2-ov-3.txt 2>/tmp/soc2-ov-3.err; then
      echo "FAIL: ENABLE_CLOUD_TRAIL=true should be rejected" >&2
      fail=1
    fi

    # Skip flag rejected
    unset ENABLE_CLOUD_TRAIL CAD_WRITEBACK_ENABLED
    export SOC2_SKIP_LIVE_OVERRIDES=1
    if rc_soc2_apply_live_production_overrides >/tmp/soc2-ov-4.txt 2>/tmp/soc2-ov-4.err; then
      echo "FAIL: SOC2_SKIP_LIVE_OVERRIDES=1 should be rejected" >&2
      fail=1
    fi

    if [[ "${fail}" -ne 0 ]]; then
      echo "soc2-live-production-overrides self-test FAILED" >&2
      exit 1
    fi
    echo "soc2-live-production-overrides self-test OK"
    exit 0
  fi
  rc_soc2_apply_live_production_overrides
fi
