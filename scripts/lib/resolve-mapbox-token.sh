#!/usr/bin/env bash
# Resolve NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN without printing the secret.
# Order: existing env → scripts/.deploy-secrets.local.sh → SSM → CodeBuild project env.
resolve_mapbox_token() {
  local region="${AWS_REGION:-${AWS_DEFAULT_REGION:-us-east-1}}"
  local ssm_name="${MAPBOX_SSM_PARAMETER:-/rapidcortex/prod/mapbox/public-token}"
  local codebuild_project="${MAPBOX_CODEBUILD_PROJECT:-rapid-cortex-web-build-prod}"
  local _lib_dir _secrets_file

  _lib_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  _secrets_file="${_lib_dir}/../.deploy-secrets.local.sh"

  if [[ -n "${NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN:-}" && "${NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN}" != "pk.REPLACE_WITH_REAL_TOKEN" ]]; then
    return 0
  fi

  if [[ -f "${_secrets_file}" ]]; then
    # shellcheck source=/dev/null
    source "${_secrets_file}"
    if [[ -n "${NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN:-}" && "${NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN}" != "pk.REPLACE_WITH_REAL_TOKEN" ]]; then
      return 0
    fi
  fi

  local from_ssm=""
  from_ssm="$(
    aws ssm get-parameter \
      --name "${ssm_name}" \
      --with-decryption \
      --query 'Parameter.Value' \
      --output text \
      --region "${region}" 2>/dev/null || true
  )"
  if [[ -n "${from_ssm}" && "${from_ssm}" != "None" && "${from_ssm}" != "pk.REPLACE_WITH_REAL_TOKEN" ]]; then
    export NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN="${from_ssm}"
    unset from_ssm
    return 0
  fi
  unset from_ssm

  local from_cb=""
  from_cb="$(
    aws codebuild batch-get-projects \
      --names "${codebuild_project}" \
      --region "${region}" \
      --query "projects[0].environment.environmentVariables[?name=='NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN'].value | [0]" \
      --output text 2>/dev/null || true
  )"
  if [[ -n "${from_cb}" && "${from_cb}" != "None" && "${from_cb}" != "pk.REPLACE_WITH_REAL_TOKEN" ]]; then
    export NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN="${from_cb}"
    unset from_cb
    return 0
  fi
  unset from_cb

  return 1
}

# Resolve Mapbox Studio style URLs from SSM.
# Paths: /rapidcortex/prod/mapbox/style-dark and style-light
# SSM wins when readable so production builds bake the stored Studio URLs.
resolve_mapbox_styles() {
  local region="${AWS_REGION:-${AWS_DEFAULT_REGION:-us-east-1}}"
  local dark_ssm="${MAPBOX_STYLE_DARK_SSM_PARAMETER:-/rapidcortex/prod/mapbox/style-dark}"
  local light_ssm="${MAPBOX_STYLE_LIGHT_SSM_PARAMETER:-/rapidcortex/prod/mapbox/style-light}"
  local from_ssm=""

  from_ssm="$(
    aws ssm get-parameter \
      --name "${dark_ssm}" \
      --query 'Parameter.Value' \
      --output text \
      --region "${region}" 2>/dev/null || true
  )"
  if [[ -n "${from_ssm}" && "${from_ssm}" != "None" ]]; then
    export NEXT_PUBLIC_MAPBOX_STYLE_URL_DARK="${from_ssm}"
    export NEXT_PUBLIC_MAPBOX_STYLE_DARK="${from_ssm}"
  elif [[ -z "${NEXT_PUBLIC_MAPBOX_STYLE_URL_DARK:-}" && -n "${NEXT_PUBLIC_MAPBOX_STYLE_DARK:-}" ]]; then
    export NEXT_PUBLIC_MAPBOX_STYLE_URL_DARK="${NEXT_PUBLIC_MAPBOX_STYLE_DARK}"
  fi

  from_ssm="$(
    aws ssm get-parameter \
      --name "${light_ssm}" \
      --query 'Parameter.Value' \
      --output text \
      --region "${region}" 2>/dev/null || true
  )"
  if [[ -n "${from_ssm}" && "${from_ssm}" != "None" ]]; then
    export NEXT_PUBLIC_MAPBOX_STYLE_URL_LIGHT="${from_ssm}"
    export NEXT_PUBLIC_MAPBOX_STYLE_LIGHT="${from_ssm}"
  elif [[ -z "${NEXT_PUBLIC_MAPBOX_STYLE_URL_LIGHT:-}" && -n "${NEXT_PUBLIC_MAPBOX_STYLE_LIGHT:-}" ]]; then
    export NEXT_PUBLIC_MAPBOX_STYLE_URL_LIGHT="${NEXT_PUBLIC_MAPBOX_STYLE_LIGHT}"
  fi
  unset from_ssm
}
