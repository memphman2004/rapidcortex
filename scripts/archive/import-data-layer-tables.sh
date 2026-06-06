#!/usr/bin/env bash
# Import existing DynamoDB tables into the DataLayer nested CloudFormation stack
# (physical child of rapid-cortex-dev), linking template logical IDs to live TableName ARNs.
#
# Prerequisites:
#   - aws CLI v2, jq
#   - AWS credentials targeting the correct account / region
#   - The nested DataLayer stack MUST exist (see PhysicalResourceId of DataLayerStack on the root stack).
#     If the nested stack was deleted after a rollback, fix that in AWS before importing.
#   - CFN_TEMPLATE_BUCKET: an S3 bucket in the SAME region where stack-data-layer.yaml will be uploaded
#     (inline template exceeds the ~51KiB create-change-set body limit — TemplateURL required).
#
# Env (optional overrides):
#   ROOT_STACK_NAME        default: rapid-cortex-dev
#   NESTED_STACK_NAME      if unset, resolves from ROOT_STACK_NAME LogicalResourceId DataLayerStack
#   AWS_REGION / AWS_DEFAULT_REGION
#   RESOURCES_TO_IMPORT    default: <repo>/scripts/resources-to-import.json
#   CHANGE_SET_NAME_IMPORT default: import-data-layer-ddb-<epoch>
#   CFN_TEMPLATE_BUCKET    required (see above)
#   PARAMETERS_JSON_FILE   optional; if set, merges this [{ParameterKey,ParameterValue}] into the API body.
#                          Omit to preserve the nested stack parameter values AWS already has stored.
#   SKIP_EXECUTE_CHANGE_SET set to "1" to create the change set only (no execute, no waiter)
#
# Usage:
#   export CFN_TEMPLATE_BUCKET=my-cfn-templates-bucket
#   ./scripts/import-data-layer-tables.sh
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
TEMPLATE_FILE="$ROOT/infra/nested/stack-data-layer.yaml"
RESOURCES_JSON="${RESOURCES_TO_IMPORT:-$ROOT/scripts/archive/resources-to-import.json}"

ROOT_STACK_NAME="${ROOT_STACK_NAME:-rapid-cortex-dev}"
CHANGE_SET_NAME_IMPORT="${CHANGE_SET_NAME_IMPORT:-import-data-layer-ddb-$(date +%s)}"
REGION="${AWS_REGION:-${AWS_DEFAULT_REGION:-}}"
SKIP_EXECUTE_CHANGE_SET="${SKIP_EXECUTE_CHANGE_SET:-0}"

die() {
  echo "import-data-layer-tables.sh: $*" >&2
  exit 1
}

need() {
  command -v "$1" >/dev/null 2>&1 || die "missing '$1'"
}

need aws
need jq

[[ -f "$TEMPLATE_FILE" ]] || die "template not found: $TEMPLATE_FILE"
[[ -f "$RESOURCES_JSON" ]] || die "resources file not found: $RESOURCES_JSON"
jq empty "$RESOURCES_JSON" || die "invalid JSON in $RESOURCES_JSON"

[[ -n "$REGION" ]] || die "set AWS_REGION (or AWS_DEFAULT_REGION)"
[[ -n "${CFN_TEMPLATE_BUCKET:-}" ]] || die "set CFN_TEMPLATE_BUCKET to an S3 bucket in region $REGION for template upload"

TEMPLATE_SIZE="$(wc -c <"$TEMPLATE_FILE" | tr -d ' ')"
# CloudFormation ChangeSet TemplateBody limit ~51KiB — we always upload for consistency above that threshold or when large.
if [[ "$TEMPLATE_SIZE" -le 49152 ]]; then
  echo "(info: template is ${TEMPLATE_SIZE} bytes; still using S3 TemplateURL — set CFN_TEMPLATE_BUCKET.)" >&2
fi

if [[ -z "${NESTED_STACK_NAME:-}" ]]; then
  NESTED_STACK_NAME="$(
    aws cloudformation describe-stack-resource \
      --stack-name "$ROOT_STACK_NAME" \
      --logical-resource-id DataLayerStack \
      --region "$REGION" \
      --query 'StackResourceDetail.PhysicalResourceId' \
      --output text 2>/dev/null || true
  )"
  [[ -n "$NESTED_STACK_NAME" ]] && [[ "$NESTED_STACK_NAME" != "None" ]] || die \
    "could not resolve nested stack from $ROOT_STACK_NAME LogicalResourceId=DataLayerStack. Set NESTED_STACK_NAME explicitly (stack name or ARN)."
fi

aws cloudformation describe-stacks \
  --stack-name "$NESTED_STACK_NAME" \
  --region "$REGION" >/dev/null 2>&1 || die \
  "nested stack not found (describe-stacks failed): $NESTED_STACK_NAME"

STACK_STATUS="$(aws cloudformation describe-stacks \
  --stack-name "$NESTED_STACK_NAME" \
  --region "$REGION" \
  --query 'Stacks[0].StackStatus' \
  --output text)"
echo "Using nested stack: $NESTED_STACK_NAME"
echo "StackStatus:              $STACK_STATUS"

S3_KEY="rapid-cortex/import-data-layer/${CHANGE_SET_NAME_IMPORT}/stack-data-layer.yaml"
TEMPLATE_URL="https://${CFN_TEMPLATE_BUCKET}.s3.${REGION}.amazonaws.com/${S3_KEY}"

echo "Uploading nested template → s3://${CFN_TEMPLATE_BUCKET}/${S3_KEY}"
aws s3 cp "$TEMPLATE_FILE" "s3://${CFN_TEMPLATE_BUCKET}/${S3_KEY}" \
  --region "$REGION"

# Omit Parameters unless PARAMETERS_JSON_FILE is set → CloudFormation keeps existing nested-stack values.

CLI_BODY_FILE="$(mktemp "${TMPDIR:-/tmp}/import-cs-body.XXXXXX.json")"
trap 'rm -f "$CLI_BODY_FILE"' EXIT

CLI_BODY_BASE="$(jq -n \
  --arg StackName "$NESTED_STACK_NAME" \
  --arg ChangeSetName "$CHANGE_SET_NAME_IMPORT" \
  --arg TemplateURL "$TEMPLATE_URL" \
  --slurpfile ResourcesToImport "$RESOURCES_JSON" \
  '{
    StackName: $StackName,
    ChangeSetName: $ChangeSetName,
    ChangeSetType: "IMPORT",
    TemplateURL: $TemplateURL,
    ResourcesToImport: $ResourcesToImport[0]
  }')"

if [[ -n "${PARAMETERS_JSON_FILE:-}" ]]; then
  param_blob="$(jq -c '.' "$PARAMETERS_JSON_FILE")" || die "invalid PARAMETERS_JSON_FILE"
  CLI_BODY_FINAL="$(jq --argjson p "$param_blob" '. + { Parameters: $p }' <<<"$CLI_BODY_BASE")" || die "merge PARAMETERS_JSON_FILE failed"
else
  CLI_BODY_FINAL="$CLI_BODY_BASE"
fi

printf '%s' "$CLI_BODY_FINAL" >"$CLI_BODY_FILE"

echo ""
echo "Creating IMPORT change set: $CHANGE_SET_NAME_IMPORT"
aws cloudformation create-change-set \
  --cli-input-json "file://${CLI_BODY_FILE}" \
  --region "$REGION"

echo "Waiting for change set to finish validating..."
aws cloudformation wait change-set-create-complete \
  --stack-name "$NESTED_STACK_NAME" \
  --change-set-name "$CHANGE_SET_NAME_IMPORT" \
  --region "$REGION" || {

  echo "--- describe-change-set (failure diagnostics) ---"
  aws cloudformation describe-change-set \
    --stack-name "$NESTED_STACK_NAME" \
    --change-set-name "$CHANGE_SET_NAME_IMPORT" \
    --region "$REGION"
  die "change-set-create-complete waiter failed."
}

CST_STATUS="$(aws cloudformation describe-change-set \
  --stack-name "$NESTED_STACK_NAME" \
  --change-set-name "$CHANGE_SET_NAME_IMPORT" \
  --region "$REGION" \
  --query 'Status' \
  --output text)"
CST_REASON="$(aws cloudformation describe-change-set \
  --stack-name "$NESTED_STACK_NAME" \
  --change-set-name "$CHANGE_SET_NAME_IMPORT" \
  --region "$REGION" \
  --query 'StatusReason' \
  --output text)"

echo "ChangeSet Status: $CST_STATUS ($CST_REASON)"
[[ "$CST_STATUS" == "CREATE_COMPLETE" ]] || die "change set status is $CST_STATUS"

if [[ "$SKIP_EXECUTE_CHANGE_SET" == "1" ]]; then
  echo "SKIP_EXECUTE_CHANGE_SET=1 — skipping execute-change-set."
  exit 0
fi

echo ""
echo "Executing import change set..."
aws cloudformation execute-change-set \
  --stack-name "$NESTED_STACK_NAME" \
  --change-set-name "$CHANGE_SET_NAME_IMPORT" \
  --region "$REGION"

echo "Waiting for nested stack to finish (imports may end IMPORT_COMPLETE or UPDATE_COMPLETE if other resources change)..."
deadline=$((SECONDS + 7200))
while (( SECONDS < deadline )); do
  STATUS="$(aws cloudformation describe-stacks \
    --stack-name "$NESTED_STACK_NAME" \
    --region "$REGION" \
    --query 'Stacks[0].StackStatus' \
    --output text)"
  case "$STATUS" in
    IMPORT_COMPLETE | UPDATE_COMPLETE | CREATE_COMPLETE)
      echo ""
      echo "Nested stack stabilized: $STATUS"
      ;;
    *IN_PROGRESS)
      echo " … $STATUS ($(date -u +%H:%M:%S)Z)"
      sleep 15
      continue
      ;;
    IMPORT_FAILED | CREATE_FAILED | UPDATE_FAILED | DELETE_FAILED | REVIEW_FAILED | ROLLBACK_FAILED | IMPORT_ROLLBACK_FAILED | STACK_SET_OR_CHILD_ROLLBACK_FAILED | IMPORT_ROLLBACK_COMPLETE | UPDATE_ROLLBACK_COMPLETE | ROLLBACK_COMPLETE | DELETE_COMPLETE)
      die "nested stack terminal status: $STATUS (see CloudFormation Events)"
      ;;
    *)
      echo " … $STATUS ($(date -u +%H:%M:%S)Z)"
      sleep 15
      continue
      ;;
  esac
  break
done

if (( SECONDS >= deadline )); then
  die "timed out waiting for nested stack stabilization"
fi

echo ""
echo "Import / update finished for nested DataLayer stack; listed DynamoDB logical IDs are mapped to existing tables."
echo "Other CloudFormation template resources without an import mapping may still be created or modified in this run."
echo "When the nested stack matches the repo template, rerun ./scripts/deploy.sh dev."
