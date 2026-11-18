#!/usr/bin/env bash
# check-stack-removals.sh — Detect nested stack removals before deploy
#
# Diffs infra/template.yaml against the DEPLOYED root stack template.
# Exits non-zero (and blocks deploy) if any nested stack is being removed
# unless --confirm-stack-removals is passed.
#
# Usage:
#   bash scripts/check-stack-removals.sh [--confirm-stack-removals] [stage]
#   stage defaults to "dev"
#
# Called by deploy.sh in full and stack modes.
#
# NexCortiQ | AWS Account 158961537080 | Profile rapid-cortex

set -euo pipefail

PROFILE="${AWS_PROFILE:-rapid-cortex}"
REGION="${AWS_DEFAULT_REGION:-us-east-1}"
CONFIRM=0
STAGE="dev"

for arg in "$@"; do
  case "$arg" in
    --confirm-stack-removals) CONFIRM=1 ;;
    dev|staging|prod|pilot) STAGE="$arg" ;;
  esac
done

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ROOT_STACK="rapid-cortex-${STAGE}"
LOCAL_TPL="${ROOT}/infra/template.yaml"

echo "── Nested Stack Removal Check ──────────────────────────────"
echo "  Root stack: $ROOT_STACK"
echo "  Local template: $LOCAL_TPL"
echo ""

# Get deployed template
DEPLOYED_JSON=$(aws cloudformation get-template \
  --stack-name "$ROOT_STACK" \
  --region "$REGION" \
  --profile "$PROFILE" \
  --query TemplateBody \
  --output json 2>/dev/null || echo "null")

if [[ "$DEPLOYED_JSON" == "null" ]] || [[ -z "$DEPLOYED_JSON" ]]; then
  echo "  ⚠️  Could not fetch deployed template (stack may not exist yet). Skipping removal check."
  exit 0
fi

# Extract nested stack logical IDs from deployed template
DEPLOYED_STACKS=$(echo "$DEPLOYED_JSON" | python3 -c "
import sys, json, re
data = sys.stdin.read()
# Try JSON first
try:
    t = json.loads(data)
    resources = t.get('Resources', {})
    stacks = [k for k,v in resources.items() if v.get('Type') == 'AWS::CloudFormation::Stack']
    for s in sorted(stacks):
        print(s)
except:
    # Fall back to regex
    for m in re.finditer(r'\"([A-Za-z][A-Za-z0-9]+)\".*?\"Type\"\s*:\s*\"AWS::CloudFormation::Stack\"', data, re.DOTALL):
        print(m.group(1))
" 2>/dev/null || echo "")

# Extract nested stack logical IDs from local template (line-by-line, no backtracking)
LOCAL_STACKS=$(python3 -c "
import re, sys
with open('${LOCAL_TPL}') as f:
    lines = f.readlines()
stacks = []
for i, line in enumerate(lines):
    if 'Type: AWS::CloudFormation::Stack' in line:
        # Scan backwards for the nearest resource name (top-level key, 2-space indent)
        for j in range(i - 1, max(i - 15, -1), -1):
            m = re.match(r'^  ([A-Za-z][A-Za-z0-9]+):\\s*\$', lines[j])
            if m:
                stacks.append(m.group(1))
                break
for s in sorted(set(stacks)):
    print(s)
" 2>/dev/null || echo "")

if [[ -z "$DEPLOYED_STACKS" ]]; then
  echo "  ⚠️  No nested stacks found in deployed template. Skipping removal check."
  exit 0
fi

# Find removals
REMOVALS=$(comm -23 \
  <(echo "$DEPLOYED_STACKS" | sort) \
  <(echo "$LOCAL_STACKS" | sort) \
  2>/dev/null || echo "")

if [[ -z "$REMOVALS" ]]; then
  echo "  ✅ No nested stack removals detected."
  exit 0
fi

echo "  ⛔ NESTED STACK REMOVALS DETECTED:"
echo ""
echo "$REMOVALS" | while read -r stack; do
  echo "    REMOVE: $stack"
done
echo ""
echo "  CloudFormation will DELETE the above stacks and all their resources!"
echo ""

if [[ "$CONFIRM" -eq 1 ]]; then
  echo "  --confirm-stack-removals passed. Proceeding with removals."
  echo "  ⚠️  This is a destructive operation. Stacks with DeletionPolicy: Retain"
  echo "      will retain their data, but the stack itself will be removed."
  exit 0
else
  echo "  To proceed, re-run with --confirm-stack-removals flag."
  echo "  Example: CONFIRM_STACK_REMOVALS=1 bash scripts/deploy.sh full dev"
  exit 1
fi
