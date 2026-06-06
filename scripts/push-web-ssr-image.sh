#!/usr/bin/env bash
set -euo pipefail
# Build Dockerfile.ssr-web and push to ECR. Requires Docker (Desktop, Colima, or compatible).
#
# Usage:
#   ECR_REPOSITORY_NAME=rapid-cortex-web-ssr ./scripts/push-web-ssr-image.sh
#
# Optional:
#   IMAGE_TAG (default: latest)
#   AWS_REGION (default: us-east-1)

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

AWS_REGION="${AWS_REGION:-us-east-1}"
ECR_REPOSITORY_NAME="${ECR_REPOSITORY_NAME:?Set ECR_REPOSITORY_NAME (e.g. rapid-cortex-web-ssr)}"
IMAGE_TAG="${IMAGE_TAG:-latest}"
ACCOUNT_ID="$(aws sts get-caller-identity --query Account --output text)"
URI="${ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${ECR_REPOSITORY_NAME}:${IMAGE_TAG}"

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker is required. Install Docker Desktop, or: brew install colima docker && colima start" >&2
  exit 1
fi

aws ecr describe-repositories --repository-names "${ECR_REPOSITORY_NAME}" >/dev/null 2>&1 \
  || aws ecr create-repository --repository-name "${ECR_REPOSITORY_NAME}" --image-scanning-configuration scanOnPush=true

aws ecr get-login-password --region "${AWS_REGION}" | docker login --username AWS --password-stdin "${ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com"

# Build for the host architecture; the SSR stack parameter FargateCpuArchitecture must match
# (default ARM64 — avoids linux/amd64 QEMU OOM on Apple Silicon during `next build`).
docker build -f Dockerfile.ssr-web -t "${URI}" .
docker push "${URI}"

echo "Pushed ${URI}"
