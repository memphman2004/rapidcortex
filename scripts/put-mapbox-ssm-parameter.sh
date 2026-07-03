#!/usr/bin/env bash
# Store the Mapbox public token in SSM Parameter Store for prod web deploys.
# Deploy user (rapid-cortex-deploy) reads this via scripts/lib/resolve-mapbox-token.sh.
#
# Requires admin credentials on Rapid Cortex account 158961537080 (not rapid-cortex-deploy).
#
# Usage:
#   NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN="pk...." ADMIN_AWS_PROFILE=<admin> ./scripts/put-mapbox-ssm-parameter.sh
#   ADMIN_AWS_PROFILE=<admin> ./scripts/put-mapbox-ssm-parameter.sh --from-local-secrets
#   ADMIN_AWS_PROFILE=<admin> ./scripts/put-mapbox-ssm-parameter.sh verify
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck source=scripts/lib/rapid-cortex-aws.sh
source "${ROOT}/scripts/lib/rapid-cortex-aws.sh"

SSM_NAME="${MAPBOX_SSM_PARAMETER:-/rapidcortex/prod/mapbox/public-token}"
FROM_LOCAL=0
VERIFY_ONLY=0

usage() {
  sed -n '2,10p' "$0"
  echo ""
  echo "Usage:"
  echo "  $0 verify"
  echo "  $0 --from-local-secrets"
  echo "  NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN=\"pk....\" $0"
  echo ""
  echo "Token must be a Mapbox public token (pk.*), URL-referrer restricted to:"
  echo "  https://app.rapidcortex.us  (and http://localhost:3000 for local dev)"
}

mask_token() {
  local token="$1"
  if [[ ${#token} -lt 12 ]]; then
    echo "(too short)"
    return
  fi
  echo "${token:0:8}...${token: -4}"
}

load_token_from_local_secrets() {
  local secrets_file="${ROOT}/scripts/.deploy-secrets.local.sh"
  if [[ ! -f "${secrets_file}" ]]; then
    echo "ERROR: Missing ${secrets_file} — copy from scripts/.deploy-secrets.local.example.sh" >&2
    return 1
  fi
  # shellcheck source=/dev/null
  source "${secrets_file}"
}

resolve_token() {
  if [[ -n "${NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN:-}" && "${NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN}" != "pk.REPLACE_WITH_REAL_TOKEN" ]]; then
    return 0
  fi
  if [[ "${FROM_LOCAL}" -eq 1 ]]; then
    load_token_from_local_secrets
  fi
  if [[ -z "${NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN:-}" || "${NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN}" == "pk.REPLACE_WITH_REAL_TOKEN" ]]; then
    echo "ERROR: Set NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN to a real Mapbox public token (pk.*)." >&2
    echo "  account.mapbox.com → Access tokens → create restricted public token" >&2
    return 1
  fi
  if [[ "${NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN}" != pk.* ]]; then
    echo "ERROR: Mapbox public token must start with pk." >&2
    return 1
  fi
}

cmd_verify() {
  rapid_cortex_assert_aws_account
  local value=""
  value="$(
    aws ssm get-parameter \
      --name "${SSM_NAME}" \
      --with-decryption \
      --query 'Parameter.Value' \
      --output text \
      --region "${RAPID_CORTEX_AWS_REGION}" 2>/dev/null || true
  )"
  if [[ -z "${value}" || "${value}" == "None" ]]; then
    echo "❌ SSM parameter ${SSM_NAME} is not set"
    return 1
  fi
  echo "✓ SSM parameter ${SSM_NAME} = $(mask_token "${value}")"
}

cmd_put() {
  if [[ -n "${ADMIN_AWS_PROFILE:-}" ]]; then
    export AWS_PROFILE="${ADMIN_AWS_PROFILE}"
  fi
  rapid_cortex_assert_aws_account
  resolve_token

  echo "Putting Mapbox token to SSM ${SSM_NAME} (masked: $(mask_token "${NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN}")) …"
  aws ssm put-parameter \
    --name "${SSM_NAME}" \
    --type SecureString \
    --value "${NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN}" \
    --overwrite \
    --region "${RAPID_CORTEX_AWS_REGION}" \
    --description "Mapbox public access token for prod web (NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN)" \
    --tags "Key=app,Value=rapid-cortex" "Key=component,Value=web" "Key=stage,Value=prod" \
    >/dev/null

  echo "✓ SSM parameter updated"
  cmd_verify
  echo ""
  echo "Next: redeploy web so CodeBuild bakes the token into the image:"
  echo "  source scripts/env-web-ssr-prod.sh && bash scripts/deploy-web-no-docker.sh prod"
}

for arg in "$@"; do
  case "${arg}" in
  verify) VERIFY_ONLY=1 ;;
  --from-local-secrets) FROM_LOCAL=1 ;;
  --help | -h)
    usage
    exit 0
    ;;
  *)
    echo "Unknown argument: ${arg}" >&2
    usage >&2
    exit 1
    ;;
  esac
done

if [[ "${VERIFY_ONLY}" -eq 1 ]]; then
  cmd_verify
  exit $?
fi

cmd_put
