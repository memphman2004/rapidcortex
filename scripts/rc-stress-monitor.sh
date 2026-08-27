#!/usr/bin/env bash
set -euo pipefail

#
# Watch ECS memory, Lambda duration, and DynamoDB consumed capacity during a stress run.
#
# This script polls CloudWatch only. It does not run k6 and does not write
# results/smoke-run-*.log or results/load-run-*.log — those come from
# bash scripts/run-k6-profile.sh (npm run stress:smoke / stress:load).
#
# Usage:
#   STAGE=dev ./scripts/rc-stress-monitor.sh
#   STAGE=dev CLUSTER=rapid-cortex-v2-web-prod SERVICE=rapid-cortex-v2-web-prod ./scripts/rc-stress-monitor.sh
#
# Targets:
#   ECS memory < 80% over the soak window (Node.js SSR leak pattern)
#   Lambda duration p99 must not drift upward (warm-pool exhaustion)
#   DynamoDB WCU < 80% of provisioned (if provisioned) on audit + incidents
#

STAGE="${STAGE:-dev}"
REGION="${AWS_REGION:-us-east-1}"
CLUSTER="${CLUSTER:-rapid-cortex-v2-web-prod}"
SERVICE="${SERVICE:-rapid-cortex-v2-web-prod}"
# POLL_SECONDS is accepted as an alias used in some runbooks.
WINDOW="${POLL_SECONDS:-${WINDOW:-300}}"

echo "Rapid Cortex stress monitor  stage=${STAGE}  cluster=${CLUSTER}  window=${WINDOW}s"
echo "Press Ctrl-C to stop."
echo ""

while true; do
  ts="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo "──── ${ts} ────"

  aws cloudwatch get-metric-statistics \
    --namespace AWS/ECS \
    --metric-name MemoryUtilization \
    --dimensions Name=ClusterName,Value="$CLUSTER" Name=ServiceName,Value="$SERVICE" \
    --start-time "$(date -u -v-${WINDOW}S +%Y-%m-%dT%H:%M:%SZ 2>/dev/null || date -u -d "-${WINDOW} seconds" +%Y-%m-%dT%H:%M:%SZ)" \
    --end-time "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
    --period 60 \
    --statistics Average Maximum \
    --region "$REGION" \
    --query 'Datapoints | sort_by(@, &Timestamp)[-3:].[Timestamp,Average,Maximum]' \
    --output text 2>/dev/null | awk '{printf "  ECS mem avg=%.1f%% max=%.1f%%  %s\n", $2, $3, $1}' || echo "  ECS mem: unavailable"

  for table in "rapid-cortex-audit-${STAGE}" "rapid-cortex-incidents-${STAGE}"; do
    aws cloudwatch get-metric-statistics \
      --namespace AWS/DynamoDB \
      --metric-name ConsumedWriteCapacityUnits \
      --dimensions Name=TableName,Value="$table" \
      --start-time "$(date -u -v-${WINDOW}S +%Y-%m-%dT%H:%M:%SZ 2>/dev/null || date -u -d "-${WINDOW} seconds" +%Y-%m-%dT%H:%M:%SZ)" \
      --end-time "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
      --period 60 \
      --statistics Sum \
      --region "$REGION" \
      --query 'Datapoints | sort_by(@, &Timestamp)[-1].[Timestamp,Sum]' \
      --output text 2>/dev/null | awk -v t="$table" '{printf "  DDB WCU %s  sum=%.0f  %s\n", t, $2, $1}' || true
  done

  echo ""
  sleep 30
done
