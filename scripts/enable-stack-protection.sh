#!/usr/bin/env bash
# enable-stack-protection.sh — Enable termination protection on all NexCortiQ stacks
# Run once after a successful deploy to protect all stacks from accidental deletion.
#
# Usage:
#   bash scripts/enable-stack-protection.sh [--dry-run]
#
# NexCortiQ | AWS Account 158961537080 | Profile rapid-cortex

set -euo pipefail

PROFILE="${AWS_PROFILE:-rapid-cortex}"
REGION="${AWS_DEFAULT_REGION:-us-east-1}"
DRY_RUN="${1:-}"

# Verify account
ACCOUNT=$(aws sts get-caller-identity --profile "$PROFILE" --region "$REGION" --query Account --output text 2>&1)
if [[ "$ACCOUNT" != "158961537080" ]]; then
  echo "ERROR: Wrong account. Expected 158961537080, got $ACCOUNT" >&2
  exit 1
fi

echo "NexCortiQ Stack Protection Enabler"
echo "Account: $ACCOUNT | Region: $REGION"
[[ -n "$DRY_RUN" ]] && echo "DRY RUN MODE — no changes will be made"
echo ""

# Get all healthy stacks — includes UPDATE_ROLLBACK_COMPLETE (stuck-but-functional stacks also need protection)
STACKS=$(aws cloudformation list-stacks \
    --region "$REGION" \
  --profile "$PROFILE" \
  --stack-status-filter UPDATE_COMPLETE CREATE_COMPLETE IMPORT_COMPLETE UPDATE_ROLLBACK_COMPLETE \
  --query "StackSummaries[*].StackName" \
  --output text 2>&1)

PROTECTED=0
SKIPPED=0
FAILED=0

for STACK in $STACKS; do
  # Check current protection status
  CURRENT=$(aws cloudformation describe-stacks \
    --stack-name "$STACK" \
    --region "$REGION" \
    --profile "$PROFILE" \
    --query "Stacks[0].EnableTerminationProtection" \
    --output text 2>/dev/null || echo "UNKNOWN")

  if [[ "$CURRENT" == "True" ]]; then
    echo "  ✅ Already protected: $STACK"
    SKIPPED=$((SKIPPED + 1))
    continue
  fi

  if [[ -n "$DRY_RUN" ]]; then
    echo "  → Would protect: $STACK"
    PROTECTED=$((PROTECTED + 1))
  else
    if aws cloudformation update-termination-protection \
      --stack-name "$STACK" \
      --enable-termination-protection \
      --region "$REGION" \
      --profile "$PROFILE" 2>/dev/null; then
      echo "  🔒 Protected: $STACK"
      PROTECTED=$((PROTECTED + 1))
    else
      echo "  ⚠️  Failed to protect: $STACK"
      FAILED=$((FAILED + 1))
    fi
  fi
done

echo ""
echo "Done."
echo "  Protected: $PROTECTED"
echo "  Already protected: $SKIPPED"
echo "  Failed: $FAILED"

if [[ "$FAILED" -gt 0 ]]; then
  echo ""
  echo "⚠️  Some stacks could not be protected. Check stack status and retry."
  exit 1
fi
