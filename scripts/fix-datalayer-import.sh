#!/usr/bin/env bash
set -euo pipefail
#
# fix-datalayer-import.sh
#
# Imports the 16 orphaned DataLayer resources (exist in AWS, not owned by the
# nested DataLayer stack) using a CloudFormation IMPORT change set.
#
# WHY THE PREVIOUS ATTEMPT FAILED
#   import-data-layer-tables.sh submitted the repo's stack-data-layer.yaml as
#   the IMPORT template. That template has pending diffs on existing resources
#   (IncidentsTable, BillingSchedulesTable, etc.) relative to what's deployed.
#   CloudFormation rejects IMPORT change sets that would also modify already-
#   managed resources: "You have modified resources [...] not being imported."
#
# THE FIX
#   Fetch the currently-deployed nested template via --template-stage Processed
#   (YAML string via jq -r '.TemplateBody'), pin every existing stack resource to
#   its physical name (TableName/BucketName/Secret Name), then append ONLY the 16
#   new resource blocks from the repo YAML with literal import identifiers.
#   get-template alone drifts on ~58 TableName Fn::If expressions vs stack state;
#   IMPORT rejects that as "modified resources not being imported."
#
# USAGE
#   export AWS_REGION=us-east-1
#   bash scripts/fix-datalayer-import.sh [dev]
#
#   Dry-run (creates change set, does not execute):
#   SKIP_EXECUTE=1 bash scripts/fix-datalayer-import.sh [dev]
#
# ENV
#   AWS_REGION            required
#   STAGE                 default: first arg (default: dev)
#   ROOT_STACK_NAME       default: rapid-cortex-dev
#   SAM_DEPLOY_BUCKET     default: aws-sam-cli-managed-default-samclisourcebucket-cytgt6pjll2k
#   SKIP_EXECUTE          set 1 to create but not execute the change set
#

STAGE="${1:-dev}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REGION="${AWS_REGION:-${AWS_DEFAULT_REGION:-us-east-1}}"
ROOT_STACK="${ROOT_STACK_NAME:-rapid-cortex-dev}"
SAM_BUCKET="${SAM_DEPLOY_BUCKET:-aws-sam-cli-managed-default-samclisourcebucket-cytgt6pjll2k}"
IMPORT_JSON="${ROOT}/scripts/resources-to-import-new.json"
REPO_TEMPLATE="${ROOT}/infra/nested/stack-data-layer.yaml"
SKIP_EXECUTE="${SKIP_EXECUTE:-0}"

die()  { echo "fix-datalayer-import.sh: $*" >&2; exit 1; }
ok()   { echo "  ✓ $*"; }
need() { command -v "$1" >/dev/null 2>&1 || die "missing tool: $1 (brew install $1)"; }

need aws
need jq
need python3

[[ -f "$IMPORT_JSON" ]] || die "import list not found: $IMPORT_JSON"
[[ -f "$REPO_TEMPLATE" ]] || die "repo template not found: $REPO_TEMPLATE"

echo "=== DataLayer IMPORT fix ==="
echo "Stage        : $STAGE"
echo "Region       : $REGION"
echo "Root stack   : $ROOT_STACK"
echo "SAM bucket   : $SAM_BUCKET"
echo ""

# ── Resolve nested DataLayer stack ───────────────────────────────────────────
echo "Resolving DataLayerStack …"
NESTED_STACK="$(
  aws cloudformation describe-stack-resource \
    --stack-name "$ROOT_STACK" \
    --logical-resource-id DataLayerStack \
    --region "$REGION" \
    --query 'StackResourceDetail.PhysicalResourceId' \
    --output text 2>/dev/null || echo ""
)"
[[ -n "$NESTED_STACK" && "$NESTED_STACK" != "None" ]] || \
  die "could not resolve DataLayerStack from $ROOT_STACK. Check AWS credentials and region."

STACK_STATUS="$(
  aws cloudformation describe-stacks \
    --stack-name "$NESTED_STACK" \
    --region "$REGION" \
    --query 'Stacks[0].StackStatus' \
    --output text
)"
ok "Nested stack : $NESTED_STACK ($STACK_STATUS)"

# Warn but don't hard-fail — IMPORT is valid from UPDATE_ROLLBACK_COMPLETE
if [[ "$STACK_STATUS" != "UPDATE_ROLLBACK_COMPLETE" && \
      "$STACK_STATUS" != "UPDATE_COMPLETE" && \
      "$STACK_STATUS" != "CREATE_COMPLETE" && \
      "$STACK_STATUS" != "IMPORT_COMPLETE" ]]; then
  echo "  ⚠ Unexpected stack status: $STACK_STATUS — proceeding anyway"
fi

echo ""

# ── Fetch deployed template (Processed = JSON, exactly matches stack state) ──
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

echo "Fetching deployed template (Processed) …"
aws cloudformation get-template \
  --stack-name "$NESTED_STACK" \
  --template-stage Processed \
  --output json \
  --region "$REGION" \
  | jq -r '.TemplateBody' > "$WORK/deployed.yaml"

echo "Fetching stack resource physical IDs …"
aws cloudformation list-stack-resources \
  --stack-name "$NESTED_STACK" \
  --region "$REGION" \
  --output json > "$WORK/stack-resources.json"

# ── Merge: pin physical names, append 16 new resource blocks from repo YAML ─
echo "Pinning physical names and merging import resource blocks …"

python3 - "$IMPORT_JSON" "$REPO_TEMPLATE" "$WORK/deployed.yaml" "$WORK/stack-resources.json" "$WORK/merged.json" << 'PYEOF'
import sys, json, yaml

import_json_path, repo_yaml_path, deployed_yaml_path, stack_resources_path, out_path = sys.argv[1:]

CFN_TAG_MAP = {
    'Ref': 'Ref',
    'Condition': 'Condition',
    'Sub': 'Fn::Sub',
    'If': 'Fn::If',
    'And': 'Fn::And',
    'Or': 'Fn::Or',
    'Not': 'Fn::Not',
    'Equals': 'Fn::Equals',
    'Select': 'Fn::Select',
    'Split': 'Fn::Split',
    'Join': 'Fn::Join',
    'FindInMap': 'Fn::FindInMap',
    'Base64': 'Fn::Base64',
    'Cidr': 'Fn::Cidr',
    'ImportValue': 'Fn::ImportValue',
    'Transform': 'Fn::Transform',
    'Length': 'Fn::Length',
    'ToJsonString': 'Fn::ToJsonString',
}

class CfnLoader(yaml.SafeLoader):
    pass

def _getatt_constructor(loader, node):
    if isinstance(node, yaml.ScalarNode):
        val = loader.construct_scalar(node)
        parts = val.split('.', 1)
        return {'Fn::GetAtt': parts}
    return {'Fn::GetAtt': loader.construct_sequence(node, deep=True)}

CfnLoader.add_constructor('!GetAtt', _getatt_constructor)

def _make_constructor(fn_key):
    def _c(loader, node):
        if isinstance(node, yaml.ScalarNode):
            return {fn_key: loader.construct_scalar(node)}
        elif isinstance(node, yaml.SequenceNode):
            return {fn_key: loader.construct_sequence(node, deep=True)}
        return {fn_key: loader.construct_mapping(node, deep=True)}
    return _c

for tag, fn_key in CFN_TAG_MAP.items():
    CfnLoader.add_constructor(f'!{tag}', _make_constructor(fn_key))

def _fallback_constructor(loader, tag_suffix, node):
    if isinstance(node, yaml.SequenceNode):
        return loader.construct_sequence(node, deep=True)
    if isinstance(node, yaml.MappingNode):
        return loader.construct_mapping(node, deep=True)
    return loader.construct_scalar(node)

CfnLoader.add_multi_constructor('', _fallback_constructor)

with open(import_json_path) as f:
    import_list = json.load(f)
import_ids = {r['LogicalResourceId'] for r in import_list}

with open(repo_yaml_path) as f:
    repo_template = yaml.load(f, Loader=CfnLoader)

with open(deployed_yaml_path) as f:
    deployed_template = yaml.load(f, Loader=CfnLoader)

with open(deployed_yaml_path) as f:
    deployed_template = yaml.load(f, Loader=CfnLoader)

stack_resources = json.load(open(stack_resources_path))
import_by_id = {r['LogicalResourceId']: r for r in import_list}

def pin_physical_name(lid, physical, resource_type):
    props = deployed_template['Resources'][lid].setdefault('Properties', {})
    if resource_type == 'AWS::DynamoDB::Table':
        props['TableName'] = physical
    elif resource_type == 'AWS::S3::Bucket':
        props['BucketName'] = physical
    elif resource_type == 'AWS::SecretsManager::Secret':
        ident = import_by_id.get(lid, {}).get('ResourceIdentifier', {})
        props['Name'] = ident.get('Id') or physical.rsplit(':', 1)[-1]

pinned = 0
for summary in stack_resources.get('StackResourceSummaries', []):
    lid = summary.get('LogicalResourceId')
    physical = summary.get('PhysicalResourceId')
    rtype = summary.get('ResourceType')
    if not lid or not physical or lid not in deployed_template.get('Resources', {}):
        continue
    pin_physical_name(lid, physical, rtype)
    pinned += 1

print(f'  pin   {pinned} existing stack resource(s) to physical names', file=sys.stderr)

deployed_resource_ids = set(deployed_template.get('Resources', {}).keys())
added, skipped, missing = [], [], []

for lid in sorted(import_ids):
    if lid in deployed_resource_ids:
        skipped.append(lid)
        print(f'  skip  {lid} (already in deployed stack — will not re-import)', file=sys.stderr)
        continue
    if lid not in repo_template.get('Resources', {}):
        missing.append(lid)
        print(f'  MISS  {lid} — not found in repo template', file=sys.stderr)
        continue
    block = dict(repo_template['Resources'][lid])
    block.pop('Condition', None)
    deployed_template['Resources'][lid] = block
    ident = import_by_id[lid].get('ResourceIdentifier', {})
    props = deployed_template['Resources'][lid].setdefault('Properties', {})
    if 'TableName' in ident:
        props['TableName'] = ident['TableName']
    if 'BucketName' in ident:
        props['BucketName'] = ident['BucketName']
    if 'Id' in ident:
        props['Name'] = ident['Id']
    added.append(lid)
    print(f'  add   {lid}', file=sys.stderr)

print('', file=sys.stderr)

if missing:
    print(f'ERROR: {len(missing)} resource(s) not found in repo template: {missing}', file=sys.stderr)
    print('Update the repo template or remove those IDs from resources-to-import-new.json.', file=sys.stderr)
    sys.exit(1)

if skipped:
    print(f'NOTE: {len(skipped)} resource(s) already in stack — excluded from change set body', file=sys.stderr)
    print(f'  Skipped: {skipped}', file=sys.stderr)

print(f'Added {len(added)} new resource block(s) to import template.', file=sys.stderr)
print(f'Merged template total: {len(deployed_template["Resources"])} resources.', file=sys.stderr)

with open(out_path, 'w') as f:
    json.dump(deployed_template, f)

import os
filtered_imports = [r for r in import_list if r['LogicalResourceId'] not in skipped]
filtered_path = os.path.join(os.path.dirname(out_path), 'filtered-imports.json')
with open(filtered_path, 'w') as f:
    json.dump(filtered_imports, f, indent=2)
print(f'Filtered import list ({len(filtered_imports)} items): {filtered_path}', file=sys.stderr)
PYEOF

MERGED_COUNT="$(jq '.Resources | length' "$WORK/merged.json")"
FILTERED_IMPORT_COUNT="$(jq 'length' "$WORK/filtered-imports.json")"
ok "Merged template: $MERGED_COUNT resources total"
ok "Import list    : $FILTERED_IMPORT_COUNT resource(s) to import"
echo ""

if [[ "$FILTERED_IMPORT_COUNT" == "0" ]]; then
  echo "All resources are already owned by the stack — nothing to import."
  echo "The stack may have already been fixed. Run deploy.sh directly."
  exit 0
fi

# ── Upload merged template to S3 ──────────────────────────────────────────────
TS="$(date +%s)"
S3_KEY="cfn-import/${STAGE}/fix-datalayer-import-${TS}.json"
TEMPLATE_URL="https://${SAM_BUCKET}.s3.${REGION}.amazonaws.com/${S3_KEY}"
CHANGE_SET_NAME="fix-datalayer-import-${TS}"

echo "Uploading merged template → s3://${SAM_BUCKET}/${S3_KEY} …"
aws s3 cp "$WORK/merged.json" "s3://${SAM_BUCKET}/${S3_KEY}" \
  --region "$REGION" --no-progress
ok "Template uploaded"
echo ""

# ── Create IMPORT change set ──────────────────────────────────────────────────
CS_BODY="$WORK/changeset-body.json"
jq -n \
  --arg StackName  "$NESTED_STACK" \
  --arg CSName     "$CHANGE_SET_NAME" \
  --arg TemplateURL "$TEMPLATE_URL" \
  --slurpfile Imports "$WORK/filtered-imports.json" \
  '{
    StackName:         $StackName,
    ChangeSetName:     $CSName,
    ChangeSetType:     "IMPORT",
    TemplateURL:       $TemplateURL,
    ResourcesToImport: $Imports[0]
  }' > "$CS_BODY"

echo "Creating IMPORT change set: $CHANGE_SET_NAME …"
aws cloudformation create-change-set \
  --cli-input-json "file://${CS_BODY}" \
  --region "$REGION"

echo "Waiting for change set validation (may take 30–120 s) …"
aws cloudformation wait change-set-create-complete \
  --stack-name "$NESTED_STACK" \
  --change-set-name "$CHANGE_SET_NAME" \
  --region "$REGION" || {
  echo ""
  echo "--- change set diagnostics ---"
  aws cloudformation describe-change-set \
    --stack-name "$NESTED_STACK" \
    --change-set-name "$CHANGE_SET_NAME" \
    --region "$REGION" \
    --output json \
    | jq '{Status, StatusReason}'
  die "IMPORT change set validation failed — see StatusReason above"
}

CS_STATUS="$(
  aws cloudformation describe-change-set \
    --stack-name "$NESTED_STACK" \
    --change-set-name "$CHANGE_SET_NAME" \
    --region "$REGION" \
    --query 'Status' \
    --output text
)"
ok "Change set status: $CS_STATUS"

[[ "$CS_STATUS" == "CREATE_COMPLETE" ]] || \
  die "change set did not reach CREATE_COMPLETE (got: $CS_STATUS)"

if [[ "$SKIP_EXECUTE" == "1" ]]; then
  echo ""
  echo "SKIP_EXECUTE=1 — change set created but NOT executed."
  echo "Review it in the CloudFormation console, then execute with:"
  echo ""
  echo "  aws cloudformation execute-change-set \\"
  echo "    --stack-name '$NESTED_STACK' \\"
  echo "    --change-set-name '$CHANGE_SET_NAME' \\"
  echo "    --region $REGION"
  exit 0
fi

# ── Execute IMPORT change set ─────────────────────────────────────────────────
echo ""
echo "Executing IMPORT change set …"
aws cloudformation execute-change-set \
  --stack-name "$NESTED_STACK" \
  --change-set-name "$CHANGE_SET_NAME" \
  --region "$REGION"

echo "Waiting for IMPORT_COMPLETE / UPDATE_COMPLETE …"
deadline=$((SECONDS + 3600))
while (( SECONDS < deadline )); do
  STATUS="$(
    aws cloudformation describe-stacks \
      --stack-name "$NESTED_STACK" \
      --region "$REGION" \
      --query 'Stacks[0].StackStatus' \
      --output text
  )"
  case "$STATUS" in
    IMPORT_COMPLETE|UPDATE_COMPLETE|CREATE_COMPLETE)
      echo ""
      echo "✅  Nested DataLayer stack: $STATUS"
      echo ""
      echo "All orphaned resources are now owned by the stack."
      echo ""
      echo "Next step — redeploy:"
      echo "  source scripts/env-api-dev.sh && bash scripts/deploy.sh dev"
      exit 0
      ;;
    *IN_PROGRESS)
      printf "    … %s (%s)\r" "$STATUS" "$(date -u +%H:%M:%SZ)"
      sleep 15
      continue
      ;;
    IMPORT_ROLLBACK_COMPLETE|IMPORT_ROLLBACK_FAILED|UPDATE_ROLLBACK_COMPLETE|*_FAILED)
      echo ""
      echo "--- stack events (last 15) ---"
      aws cloudformation describe-stack-events \
        --stack-name "$NESTED_STACK" \
        --region "$REGION" \
        --query 'StackEvents[:15].[Timestamp,LogicalResourceId,ResourceStatus,ResourceStatusReason]' \
        --output table 2>/dev/null || true
      die "Stack reached terminal failure state: $STATUS"
      ;;
    *)
      printf "    … %s (%s)\r" "$STATUS" "$(date -u +%H:%M:%SZ)"
      sleep 15
      continue
      ;;
  esac
done

die "timed out waiting for stack stabilization after $(( SECONDS / 60 )) minutes"
