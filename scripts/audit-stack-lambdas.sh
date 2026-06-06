#!/usr/bin/env bash
# Compare `infra/template.yaml` unique AWS::Serverless::Function logical IDs to a CloudFormation stack.
# Usage: STACK_NAME=rapid-cortex-dev AWS_REGION=us-east-1 ./scripts/audit-stack-lambdas.sh
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
STACK_NAME="${STACK_NAME:-rapid-cortex-dev}"
AWS_REGION="${AWS_REGION:-us-east-1}"
TMP="$(mktemp)"
trap 'rm -f "$TMP"' EXIT

grep -E '^[[:space:]]+[A-Za-z0-9]+Function:[[:space:]]*$' infra/template.yaml \
  | sed 's/^[[:space:]]*//;s/:$//' \
  | sort -u > "$TMP.expect"

aws cloudformation list-stack-resources --region "$AWS_REGION" --stack-name "$STACK_NAME" \
  --query "StackResourceSummaries[?ResourceType=='AWS::Lambda::Function'].LogicalResourceId" \
  --output text | tr '\t' '\n' | sort -u > "$TMP.actual" || true

echo "=== Template: $(wc -l < "$TMP.expect" | tr -d ' ') unique *Function resources ==="
echo "=== Stack:  $(wc -l < "$TMP.actual" | tr -d ' ') Lambda::Function resources   ==="
echo ""
echo "In template, missing from stack (expected: LiveVideo* when EnableLiveVideoResources is not 'true'):"
comm -23 "$TMP.expect" "$TMP.actual" || true
echo ""
echo "In stack, not in template (unexpected):"
comm -13 "$TMP.expect" "$TMP.actual" || true
