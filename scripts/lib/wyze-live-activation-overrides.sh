# shellcheck shell=bash
# Track 3 — Wyze camera integration on live production (DeploymentStage=dev).
#
# The Wyze Lambdas/tables are gated by CloudFormation WyzeEnabled (default false).
# This overlay forces WyzeEnabled=true on `deploy.sh dev` so the next live SAM
# update actually deploys the first working camera provider.
#
# Does not rotate secrets. Run scripts/activate-wyze.sh first.
# Does not enable CAD write-back.
#
# Skip: WYZE_ALLOW_DISABLE_LIVE=1
# Staging is unchanged (WYZE_ENABLED stays whatever env-api-staging.sh set).

if [[ "${STAGE:-}" == "dev" && "${WYZE_ALLOW_DISABLE_LIVE:-}" != "1" ]]; then
  export WYZE_ENABLED=true
  export ENABLE_CONNECT_WYZE=true
  echo "Wyze live activation: WyzeEnabled=true (set WYZE_ALLOW_DISABLE_LIVE=1 to skip)." >&2
fi
