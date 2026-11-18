#!/usr/bin/env bash
# apply-stack-policies.sh — Apply CloudFormation stack policies to NexCortiQ stacks
#
# Stack policies prevent CloudFormation from replacing or deleting stateful resources
# (DynamoDB tables, S3 buckets, Cognito pools, etc.) even when a deploy is in progress.
#
# Usage:
#   bash scripts/apply-stack-policies.sh [stage] [--dry-run]
#   stage defaults to "dev"
#
# Policy files:
#   stack-policies/data-layer-policy.json   — DynamoDB, S3, Cognito, Secrets, Kinesis (Deny Replace+Delete)
#   stack-policies/app-layer-policy.json    — Lambda stacks with stateful resources
#   stack-policies/infra-layer-policy.json  — Pure infra (IAM, API GW, etc.) — Allow all
#
# NexCortiQ | AWS Account 158961537080 | Profile rapid-cortex

set -euo pipefail

PROFILE="${AWS_PROFILE:-rapid-cortex}"
REGION="${AWS_DEFAULT_REGION:-us-east-1}"
STAGE="dev"
DRY_RUN=0

for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=1 ;;
    dev|staging|prod|pilot) STAGE="$arg" ;;
  esac
done

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
POLICY_DIR="${ROOT}/stack-policies"

# Verify account
ACCOUNT=$(aws sts get-caller-identity --profile "$PROFILE" --region "$REGION" --query Account --output text 2>&1)
if [[ "$ACCOUNT" != "158961537080" ]]; then
  echo "ERROR: Wrong account. Expected 158961537080, got $ACCOUNT" >&2
  exit 1
fi

echo "NexCortiQ Stack Policy Applier"
echo "Account: $ACCOUNT | Region: $REGION | Stage: $STAGE"
[[ "$DRY_RUN" -eq 1 ]] && echo "DRY RUN MODE — no changes will be made"
echo ""

APPLIED=0
SKIPPED=0

apply_policy() {
  local stack_name="$1"
  local policy_file="$2"
  local label="${3:-}"

  if [[ ! -f "$policy_file" ]]; then
    echo "  ⚠️  Policy file not found: $policy_file — skipping $stack_name"
    SKIPPED=$((SKIPPED + 1))
    return
  fi

  # Check stack exists
  if ! aws cloudformation describe-stacks \
    --stack-name "$stack_name" \
    --region "$REGION" \
    --profile "$PROFILE" \
    --query "Stacks[0].StackName" \
    --output text 2>/dev/null | grep -q .; then
    echo "  ⚠️  Stack not found: $stack_name — skipping"
    SKIPPED=$((SKIPPED + 1))
    return
  fi

  if [[ "$DRY_RUN" -eq 1 ]]; then
    echo "  → Would apply ${label:-$(basename $policy_file)}: $stack_name"
    APPLIED=$((APPLIED + 1))
  else
    if aws cloudformation set-stack-policy \
      --stack-name "$stack_name" \
      --stack-policy-body "file://${policy_file}" \
      --region "$REGION" \
      --profile "$PROFILE" 2>/dev/null; then
      echo "  🛡️  Policy applied (${label:-$(basename $policy_file)}): $stack_name"
      APPLIED=$((APPLIED + 1))
    else
      echo "  ❌ Failed to apply policy: $stack_name"
      SKIPPED=$((SKIPPED + 1))
    fi
  fi
}

# ── Data layer stack ───────────────────────────────────────────────────────────
echo "── Data Layer Stacks ───────────────────────────────────────"
DATA_LAYER_STACK=$(aws cloudformation list-stacks \
  --region "$REGION" \
  --profile "$PROFILE" \
  --stack-status-filter UPDATE_COMPLETE CREATE_COMPLETE UPDATE_ROLLBACK_COMPLETE IMPORT_COMPLETE \
  --query "StackSummaries[?contains(StackName, 'rapid-cortex-${STAGE}') && contains(StackName, 'DataLayer') && !contains(StackName, 'Loadout') && !contains(StackName, 'Grants') && !contains(StackName, 'NexiqIntel')].StackName" \
  --output text 2>/dev/null | tr '\t' '\n' | head -1)

if [[ -n "$DATA_LAYER_STACK" ]]; then
  apply_policy "$DATA_LAYER_STACK" "${POLICY_DIR}/data-layer-policy.json" "data-layer"
else
  echo "  ⚠️  No DataLayerStack found for stage $STAGE"
fi

# ── App SAM stacks (primary Lambda stacks with stateful resources) ─────────────
echo ""
echo "── App SAM Stacks ──────────────────────────────────────────"

# Get all app sam stacks for this stage
APP_STACKS=$(aws cloudformation list-stacks \
  --region "$REGION" \
  --profile "$PROFILE" \
  --stack-status-filter UPDATE_COMPLETE CREATE_COMPLETE UPDATE_ROLLBACK_COMPLETE IMPORT_COMPLETE \
  --query "StackSummaries[?contains(StackName, 'rapid-cortex-${STAGE}') && contains(StackName, 'AppSam')].StackName" \
  --output text 2>/dev/null | tr '\t' '\n')

while IFS= read -r stack; do
  [[ -z "$stack" ]] && continue
  apply_policy "$stack" "${POLICY_DIR}/app-layer-policy.json" "app-layer"
done <<< "$APP_STACKS"

# ── Standalone CAD stacks ──────────────────────────────────────────────────────
echo ""
echo "── CAD / Standalone Stacks ─────────────────────────────────"
for cad_stack in \
  "rapid-cortex-cad-event-bus-${STAGE}" \
  "rapid-cortex-cad-session-open-${STAGE}" \
  "rapid-cortex-lex-${STAGE}"; do
  apply_policy "$cad_stack" "${POLICY_DIR}/infra-layer-policy.json" "infra-layer"
done

echo ""
echo "── Summary ─────────────────────────────────────────────────"
echo "  Applied: $APPLIED"
echo "  Skipped: $SKIPPED"
echo ""
echo "Done. Stack policies are now protecting stateful resources."
echo "To verify: aws cloudformation get-stack-policy --stack-name <name>"
