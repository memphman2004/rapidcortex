#!/usr/bin/env bash
# Create/update and attach split SAM deploy managed policies for rapid-cortex-deploy.
#
# AWS managed customer policy documents are limited to 6144 characters. Core SAM/CFN
# permissions live in sam-deploy-policy*.json; web/ECS/CodeBuild/CloudFront/SSM in
# sam-deploy-policy-web*.json. Attach both to the deploy user.
#
# Usage (prod account 158961537080):
#   ADMIN_AWS_PROFILE=<admin> ./scripts/apply-sam-deploy-managed-policies.sh
#   ADMIN_AWS_PROFILE=<admin> ./scripts/apply-sam-deploy-managed-policies.sh --verify-drift
#
# Optional env:
#   IAM_USER                    default rapid-cortex-deploy
#   IAM_POLICY_NAME             default rapid-cortex-deploy-policy
#   IAM_POLICY_WEB_NAME         default rapid-cortex-deploy-policy-web
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck source=scripts/lib/rapid-cortex-aws.sh
source "${ROOT}/scripts/lib/rapid-cortex-aws.sh"

IAM_USER="${IAM_USER:-rapid-cortex-deploy}"
IAM_POLICY_NAME="${IAM_POLICY_NAME:-rapid-cortex-deploy-policy}"
IAM_POLICY_WEB_NAME="${IAM_POLICY_WEB_NAME:-rapid-cortex-deploy-policy-web}"
CORE_POLICY_FILE="${ROOT}/infra/iam/sam-deploy-policy.prod.json"
WEB_POLICY_FILE="${ROOT}/infra/iam/sam-deploy-policy-web.prod.json"
VERIFY_DRIFT=0

for arg in "$@"; do
  case "${arg}" in
  --verify-drift) VERIFY_DRIFT=1 ;;
  --help | -h)
    sed -n '2,14p' "$0"
    exit 0
    ;;
  *)
    echo "Unknown argument: ${arg}" >&2
    exit 1
    ;;
  esac
done

if [[ ! -f "${CORE_POLICY_FILE}" || ! -f "${WEB_POLICY_FILE}" ]]; then
  echo "ERROR: Missing ${CORE_POLICY_FILE} or ${WEB_POLICY_FILE}" >&2
  exit 1
fi

if [[ -n "${ADMIN_AWS_PROFILE:-}" ]]; then
  export AWS_PROFILE="${ADMIN_AWS_PROFILE}"
fi
export AWS_REGION="${AWS_REGION:-${RAPID_CORTEX_AWS_REGION}}"

current="$(rapid_cortex_current_aws_account)"
if [[ -z "${current}" ]]; then
  echo "ERROR: AWS CLI is not authenticated." >&2
  exit 1
fi
if [[ "${current}" != "${RAPID_CORTEX_AWS_ACCOUNT_ID}" ]]; then
  echo "ERROR: Admin credentials must target account ${RAPID_CORTEX_AWS_ACCOUNT_ID} (current: ${current})." >&2
  exit 1
fi

policy_char_count() {
  python3 - "$1" <<'PY'
import json, sys
from pathlib import Path
p = Path(sys.argv[1])
doc = json.dumps(json.loads(p.read_text()), separators=(",", ":"))
print(len(doc))
PY
}

upsert_managed_policy() {
  local name="$1"
  local file="$2"
  local chars
  chars="$(policy_char_count "${file}")"
  if (( chars > 6144 )); then
    echo "ERROR: ${name} document is ${chars} chars (IAM limit 6144). Split further before apply." >&2
    exit 1
  fi
  echo "  ${name}: ${chars}/6144 chars"

  local arn
  arn="$(aws iam list-policies --scope Local --query "Policies[?PolicyName=='${name}'].Arn | [0]" --output text)"
  if [[ -z "${arn}" || "${arn}" == "None" ]]; then
    echo "Creating managed policy ${name}…"
    arn="$(aws iam create-policy \
      --policy-name "${name}" \
      --policy-document "file://${file}" \
      --query 'Policy.Arn' \
      --output text)"
  else
    echo "Updating managed policy ${name} (new default version)…"
    local non_default
    non_default="$(aws iam list-policy-versions --policy-arn "${arn}" --query 'Versions[?IsDefaultVersion==`false`].VersionId' --output text)"
    local count=0
    if [[ -n "${non_default}" ]]; then
      for _ in ${non_default}; do count=$((count + 1)); done
    fi
    if (( count >= 4 )); then
      local oldest
      oldest="$(aws iam list-policy-versions --policy-arn "${arn}" --query 'Versions[?IsDefaultVersion==`false`]|sort_by(@,&CreateDate)[0].VersionId' --output text)"
      if [[ -n "${oldest}" && "${oldest}" != "None" ]]; then
        aws iam delete-policy-version --policy-arn "${arn}" --version-id "${oldest}" >/dev/null
      fi
    fi
    aws iam create-policy-version \
      --policy-arn "${arn}" \
      --policy-document "file://${file}" \
      --set-as-default >/dev/null
  fi

  local attached
  attached="$(aws iam list-attached-user-policies --user-name "${IAM_USER}" --query 'AttachedPolicies[].PolicyArn' --output text)"
  if [[ " ${attached} " != *" ${arn} "* ]]; then
    echo "Attaching ${name} to user ${IAM_USER}…"
    aws iam attach-user-policy --user-name "${IAM_USER}" --policy-arn "${arn}"
  fi
  echo "  ARN: ${arn}"
}

echo "Applying split deploy managed policies to ${IAM_USER} (account ${RAPID_CORTEX_AWS_ACCOUNT_ID})…"
upsert_managed_policy "${IAM_POLICY_NAME}" "${CORE_POLICY_FILE}"
upsert_managed_policy "${IAM_POLICY_WEB_NAME}" "${WEB_POLICY_FILE}"

if [[ "${VERIFY_DRIFT}" -eq 1 ]]; then
  echo ""
  echo "Verifying cloudformation:DetectStackDrift as ${IAM_USER}…"
  echo "(Re-auth as deploy user if admin profile was used above.)"
  DRIFT_ID="$(AWS_PROFILE="${IAM_USER}" aws cloudformation detect-stack-drift \
    --stack-name rapid-cortex-dev \
    --region "${AWS_REGION}" \
    --query StackDriftDetectionId \
    --output text 2>/dev/null || true)"
  if [[ -n "${DRIFT_ID}" && "${DRIFT_ID}" != "None" ]]; then
    AWS_PROFILE="${IAM_USER}" aws cloudformation wait stack-drift-detection-complete \
      --stack-drift-detection-id "${DRIFT_ID}" \
      --region "${AWS_REGION}"
    AWS_PROFILE="${IAM_USER}" aws cloudformation describe-stack-drift-detection-status \
      --stack-drift-detection-id "${DRIFT_ID}" \
      --region "${AWS_REGION}" \
      --output table
  else
    echo "  Skipped drift verify (run manually after deploy-user session is active)."
  fi
fi

echo "Done."
