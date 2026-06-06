#!/usr/bin/env bash
set -euo pipefail
# Rapid Cortex — local validation + full monorepo build + Cognito trigger deps + SAM validate.
# Optionally deploy the API stack and print suggested web env vars from CloudFormation.
#
# Usage:
#   ./scripts/aws-setup.sh                    # build + validate only
#   ./scripts/aws-setup.sh --deploy dev      # + ./scripts/deploy.sh dev
#   ./scripts/aws-setup.sh --deploy prod --print-env
#   ./scripts/aws-setup.sh --print-env staging us-west-2   # stack must already exist
#
# Prerequisites: Node 22+, npm, AWS CLI, SAM CLI, AWS credentials for the target account.

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

DEPLOY=0
PRINT_ENV=0
STAGE="dev"
REGION="${AWS_REGION:-us-east-1}"

usage() {
  cat <<'EOF'
Usage: ./scripts/aws-setup.sh [options]

  (no flags)              npm install, npm run build, cognito trigger npm install, sam validate
  --deploy <stage>        run ./scripts/deploy.sh <stage> after build (dev|staging|prod|pilot)
  --print-env [stage] [region]
                          after other steps, print apps/web env suggestions from CloudFormation
  --region <region>       default AWS region for --print-env (default: $AWS_REGION or us-east-1)
  -h, --help              this message

Examples:
  ./scripts/aws-setup.sh
  ./scripts/aws-setup.sh --deploy staging
  ./scripts/aws-setup.sh --deploy prod --print-env
  ./scripts/aws-setup.sh --print-env prod eu-west-1
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --deploy)
      DEPLOY=1
      STAGE="${2:?--deploy requires stage (dev|staging|prod|pilot)}"
      shift 2
      ;;
    --print-env)
      PRINT_ENV=1
      shift
      if [[ $# -ge 1 && "${1:-}" != --* ]]; then
        STAGE="$1"
        shift
      fi
      if [[ $# -ge 1 && "${1:-}" != --* ]]; then
        REGION="$1"
        shift
      fi
      ;;
    --region)
      REGION="${2:?--region requires value}"
      shift 2
      ;;
    -h | --help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1" >&2
    exit 1
  fi
}

require_cmd npm
require_cmd aws
require_cmd sam

export AWS_REGION="$REGION"

echo "==> Install root dependencies"
npm install

echo "==> Build all workspaces (shared → web)"
npm run build

echo "==> Cognito PostConfirmation Lambda dependencies"
npm install --prefix infra/cognito-post-confirmation

echo "==> Validate SAM template"
sam validate --template-file infra/template.yaml

if [[ "$DEPLOY" == 1 ]]; then
  echo "==> Deploy stack (./scripts/deploy.sh ${STAGE})"
  ./scripts/deploy.sh "${STAGE}"
fi

if [[ "$PRINT_ENV" == 1 ]]; then
  echo "==> Web environment snippet from stack outputs"
  ./scripts/print-stack-outputs-for-web.sh "${STAGE}" "${REGION}"
fi

echo ""
echo "==> AWS setup steps finished."
if [[ "$DEPLOY" == 0 ]]; then
  echo "    Deploy when ready: ./scripts/deploy.sh ${STAGE}"
fi
if [[ "$PRINT_ENV" == 0 && "$DEPLOY" == 1 ]]; then
  echo "    Print web env:    ./scripts/print-stack-outputs-for-web.sh ${STAGE} ${REGION}"
fi
echo "    Smoke test:       ./scripts/post-deploy-smoke.sh ${STAGE} ${REGION}"
echo "    Full checklist: docs/AWS_SETUP.md"
echo ""
