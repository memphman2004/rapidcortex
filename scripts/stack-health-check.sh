#!/usr/bin/env bash
# stack-health-check.sh — NexCortiQ stack health reporter
# Run before and after every deploy.
# Any stack NOT in UPDATE_COMPLETE or CREATE_COMPLETE must be investigated.
#
# Usage:
#   bash scripts/stack-health-check.sh [stage]
#   stage defaults to "dev"
#
# NexCortiQ | AWS Account 158961537080 | Profile rapid-cortex

set -euo pipefail

PROFILE="${AWS_PROFILE:-rapid-cortex}"
REGION="${AWS_DEFAULT_REGION:-us-east-1}"
STAGE="${1:-dev}"

echo "╔══════════════════════════════════════════════════════════╗"
echo "║  NexCortiQ Stack Health Report — $(date '+%Y-%m-%d %H:%M:%S')  ║"
echo "║  Stage: ${STAGE}  |  Account: 158961537080                    ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""

# --- All stacks ---
echo "── All Stacks ─────────────────────────────────────────────"
aws cloudformation list-stacks \
  --region "$REGION" \
  --profile "$PROFILE" \
  --stack-status-filter \
    UPDATE_COMPLETE CREATE_COMPLETE \
    UPDATE_ROLLBACK_COMPLETE \
    ROLLBACK_COMPLETE \
    DELETE_FAILED \
    ROLLBACK_FAILED \
    IMPORT_COMPLETE \
    IMPORT_ROLLBACK_COMPLETE \
  --query "StackSummaries[?contains(StackName, 'rapid-cortex') || contains(StackName, 'nexcortiq')].{Stack:StackName,Status:StackStatus}" \
  --output table 2>&1

echo ""
echo "── Unhealthy Stacks (not UPDATE_COMPLETE / CREATE_COMPLETE) ──"
UNHEALTHY=$(aws cloudformation list-stacks \
  --region "$REGION" \
  --profile "$PROFILE" \
  --stack-status-filter \
    UPDATE_ROLLBACK_COMPLETE \
    ROLLBACK_COMPLETE \
    DELETE_FAILED \
    ROLLBACK_FAILED \
    UPDATE_ROLLBACK_FAILED \
  --query "StackSummaries[*].{Stack:StackName,Status:StackStatus}" \
  --output table 2>&1)

if echo "$UNHEALTHY" | grep -q "rapid-cortex\|nexcortiq"; then
  echo "$UNHEALTHY"
  echo ""
  echo "⚠️  WARN: Unhealthy stacks detected. Investigate before next deploy."
else
  echo "✅  All rapid-cortex / nexcortiq stacks are healthy."
fi

echo ""
echo "── Termination Protection ──────────────────────────────────"
UNPROTECTED=$(aws cloudformation describe-stacks \
  --region "$REGION" \
  --profile "$PROFILE" \
  --query "Stacks[?EnableTerminationProtection==\`false\` && (contains(StackName, 'rapid-cortex') || contains(StackName, 'nexcortiq'))].StackName" \
  --output text 2>&1)

if [[ -n "$UNPROTECTED" ]]; then
  echo "⚠️  Stacks WITHOUT termination protection:"
  echo "$UNPROTECTED" | tr '\t' '\n' | sed 's/^/  - /'
  echo ""
  echo "  Run: bash scripts/enable-stack-protection.sh to fix."
else
  echo "✅  All stacks have termination protection."
fi

echo ""
echo "── Summary ─────────────────────────────────────────────────"
TOTAL=$(aws cloudformation list-stacks \
  --region "$REGION" \
  --profile "$PROFILE" \
  --stack-status-filter UPDATE_COMPLETE CREATE_COMPLETE UPDATE_ROLLBACK_COMPLETE ROLLBACK_COMPLETE DELETE_FAILED ROLLBACK_FAILED IMPORT_COMPLETE \
  --query "length(StackSummaries[?contains(StackName, 'rapid-cortex') || contains(StackName, 'nexcortiq')])" \
  --output text 2>&1)

HEALTHY=$(aws cloudformation list-stacks \
  --region "$REGION" \
  --profile "$PROFILE" \
  --stack-status-filter UPDATE_COMPLETE CREATE_COMPLETE IMPORT_COMPLETE \
  --query "length(StackSummaries[?contains(StackName, 'rapid-cortex') || contains(StackName, 'nexcortiq')])" \
  --output text 2>&1)

echo "  Total stacks:   $TOTAL"
echo "  Healthy:        $HEALTHY"
echo "  Unhealthy:      $((TOTAL - HEALTHY))"
echo ""
