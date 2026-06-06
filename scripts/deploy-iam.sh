#!/usr/bin/env bash
set -euo pipefail

# Create/update IAM policy + role for SAM deploy operations.
# Required:
#   IAM_POLICY_NAME
#   IAM_ROLE_NAME
#
# Optional:
#   APP_NAME=rapid-cortex
#   AWS_REGION / AWS_DEFAULT_REGION
#   ROUTE53_HOSTED_ZONE_ID
#   IAM_ASSUME_PRINCIPAL_ARN   # who can assume IAM_ROLE_NAME (default: arn:aws:iam::<account>:root)
#
# Notes:
# - Policy source template: infra/iam/sam-deploy-policy.json
# - This script performs idempotent upserts:
#   - policy: create, or create new default version if already present
#   - role: create if missing, then attach policy

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if [[ -z "${IAM_POLICY_NAME:-}" ]]; then
  echo "IAM_POLICY_NAME is required." >&2
  exit 1
fi
if [[ -z "${IAM_ROLE_NAME:-}" ]]; then
  echo "IAM_ROLE_NAME is required." >&2
  exit 1
fi

APP_NAME="${APP_NAME:-rapid-cortex}"
AWS_REGION="${AWS_REGION:-${AWS_DEFAULT_REGION:-}}"
if [[ -z "$AWS_REGION" ]]; then
  AWS_REGION="$(aws configure get region || true)"
fi
if [[ -z "$AWS_REGION" ]]; then
  echo "Set AWS_REGION (or AWS_DEFAULT_REGION / AWS CLI default region)." >&2
  exit 1
fi

ACCOUNT_ID="$(aws sts get-caller-identity --query Account --output text)"
POLICY_TEMPLATE="$ROOT/infra/iam/sam-deploy-policy.json"
if [[ ! -f "$POLICY_TEMPLATE" ]]; then
  echo "Missing policy template: $POLICY_TEMPLATE" >&2
  exit 1
fi

TMP_POLICY="$(mktemp)"
trap 'rm -f "$TMP_POLICY"' EXIT

if [[ -n "${ROUTE53_HOSTED_ZONE_ID:-}" ]]; then
  HOSTED_ZONE_ID="$ROUTE53_HOSTED_ZONE_ID"
else
  HOSTED_ZONE_ID="*"
fi

sed \
  -e "s/REPLACE_REGION/${AWS_REGION}/g" \
  -e "s/REPLACE_ACCOUNT_ID/${ACCOUNT_ID}/g" \
  -e "s/REPLACE_HOSTED_ZONE_ID/${HOSTED_ZONE_ID}/g" \
  -e "s/rapid-cortex-/${APP_NAME}-/g" \
  "$POLICY_TEMPLATE" > "$TMP_POLICY"

POLICY_ARN="$(aws iam list-policies --scope Local --query "Policies[?PolicyName=='${IAM_POLICY_NAME}'].Arn | [0]" --output text)"
if [[ -z "$POLICY_ARN" || "$POLICY_ARN" == "None" ]]; then
  echo "Creating IAM policy ${IAM_POLICY_NAME}..."
  POLICY_ARN="$(aws iam create-policy \
    --policy-name "$IAM_POLICY_NAME" \
    --policy-document "file://${TMP_POLICY}" \
    --query 'Policy.Arn' \
    --output text)"
else
  echo "Updating IAM policy ${IAM_POLICY_NAME} (new default version)..."
  NON_DEFAULT_VERSION_IDS="$(aws iam list-policy-versions --policy-arn "$POLICY_ARN" --query 'Versions[?IsDefaultVersion==`false`].VersionId' --output text)"
  NON_DEFAULT_COUNT=0
  if [[ -n "$NON_DEFAULT_VERSION_IDS" ]]; then
    for _ in $NON_DEFAULT_VERSION_IDS; do
      NON_DEFAULT_COUNT=$((NON_DEFAULT_COUNT + 1))
    done
  fi
  if [[ "$NON_DEFAULT_COUNT" -ge 4 ]]; then
    OLDEST_NON_DEFAULT="$(aws iam list-policy-versions --policy-arn "$POLICY_ARN" --query 'Versions[?IsDefaultVersion==`false`]|sort_by(@,&CreateDate)[0].VersionId' --output text)"
    if [[ -n "$OLDEST_NON_DEFAULT" && "$OLDEST_NON_DEFAULT" != "None" ]]; then
      aws iam delete-policy-version --policy-arn "$POLICY_ARN" --version-id "$OLDEST_NON_DEFAULT" >/dev/null
    fi
  fi
  aws iam create-policy-version \
    --policy-arn "$POLICY_ARN" \
    --policy-document "file://${TMP_POLICY}" \
    --set-as-default >/dev/null
fi

ROLE_EXISTS=1
if ! aws iam get-role --role-name "$IAM_ROLE_NAME" >/dev/null 2>&1; then
  ROLE_EXISTS=0
fi

if [[ "$ROLE_EXISTS" -eq 0 ]]; then
  ASSUME_PRINCIPAL_ARN="${IAM_ASSUME_PRINCIPAL_ARN:-arn:aws:iam::${ACCOUNT_ID}:root}"
  TMP_TRUST="$(mktemp)"
  cat > "$TMP_TRUST" <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": { "AWS": "${ASSUME_PRINCIPAL_ARN}" },
      "Action": "sts:AssumeRole"
    }
  ]
}
EOF
  echo "Creating IAM role ${IAM_ROLE_NAME}..."
  aws iam create-role \
    --role-name "$IAM_ROLE_NAME" \
    --assume-role-policy-document "file://${TMP_TRUST}" >/dev/null
  rm -f "$TMP_TRUST"
else
  echo "IAM role ${IAM_ROLE_NAME} already exists."
fi

ATTACHED_ARNS="$(aws iam list-attached-role-policies --role-name "$IAM_ROLE_NAME" --query 'AttachedPolicies[].PolicyArn' --output text)"
if [[ " ${ATTACHED_ARNS} " != *" ${POLICY_ARN} "* ]]; then
  echo "Attaching policy to role..."
  aws iam attach-role-policy --role-name "$IAM_ROLE_NAME" --policy-arn "$POLICY_ARN"
fi

echo "IAM deploy role ready:"
echo "  Role name:   ${IAM_ROLE_NAME}"
echo "  Policy name: ${IAM_POLICY_NAME}"
echo "  Policy ARN:  ${POLICY_ARN}"
