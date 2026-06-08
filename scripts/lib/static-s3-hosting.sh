#!/usr/bin/env bash
# Shared helpers for Next.js static export → S3 + CloudFront (REST API origin).
# S3 serves object keys literally: /enter needs key "enter", not enter/index.html alone.
# CloudFront CustomErrorResponses map 403/404 → /index.html (homepage), which hides missing keys.
set -euo pipefail

static_s3_css_refs_from_html() {
  local html_file="$1"
  grep -oE '/_next/static/css/[a-f0-9]+\.css' "${html_file}" \
    | sed 's|^/_next/static/css/||' \
    | sort -u
}

static_s3_verify_local_css_refs() {
  local static_dir="$1"
  local html_file="${static_dir}/index.html"
  if [[ ! -f "${html_file}" ]]; then
    echo "ERROR: Missing ${html_file}" >&2
    return 1
  fi
  echo "Verifying index.html CSS references exist under ${static_dir}/_next/static/css/ ..."
  local css_file
  while IFS= read -r css_file; do
    [[ -n "${css_file}" ]] || continue
    if [[ ! -f "${static_dir}/_next/static/css/${css_file}" ]]; then
      echo "ERROR: index.html references /_next/static/css/${css_file} but that file is missing locally." >&2
      echo "Run a fresh build; do not sync HTML from one build with assets from another." >&2
      return 1
    fi
  done < <(static_s3_css_refs_from_html "${html_file}")
}

static_s3_prepare_root_html_dirs() {
  local static_dir="$1"
  echo "Preparing trailing-slash routes from root *.html in ${static_dir} ..."
  local html_file route_name
  for html_file in "${static_dir}"/*.html; do
    [[ -f "${html_file}" ]] || continue
    route_name="$(basename "${html_file}" .html)"
    if [[ "${route_name}" == "index" || "${route_name}" == "404" ]]; then
      continue
    fi
    mkdir -p "${static_dir}/${route_name}"
    cp "${html_file}" "${static_dir}/${route_name}/index.html"
  done
}

static_s3_extensionless_route_paths() {
  local static_dir="$1"
  local html_file rel route_path
  while IFS= read -r html_file; do
    [[ -n "${html_file}" ]] || continue
    rel="${html_file#${static_dir}/}"
    route_path="${rel%/index.html}"
    case "${route_path}" in
    index | 404 | _not-found) continue ;;
    esac
    printf '%s\n' "${route_path}"
  done < <(find "${static_dir}" -name index.html -type f | sort)
}

static_s3_verify_local_extensionless_routes() {
  local static_dir="$1"
  shift
  local -a required_routes=("$@")
  local route html_file
  for route in "${required_routes[@]}"; do
    html_file="${static_dir}/${route}/index.html"
    if [[ ! -f "${html_file}" ]]; then
      echo "ERROR: Required route ${route} missing at ${html_file}" >&2
      return 1
    fi
  done
  echo "Required extensionless routes present in build: ${required_routes[*]}"
}

static_s3_sync_two_pass() {
  local static_dir="$1"
  local bucket="$2"
  local region="${3:-us-east-1}"

  echo "Syncing static assets (non-HTML) to s3://${bucket}/ ..."
  aws s3 sync "${static_dir}/" "s3://${bucket}/" \
    --delete \
    --region "${region}" \
    --cache-control "public, max-age=31536000, immutable" \
    --exclude "*.html"

  # Order matters: --exclude "*" must come before --include "*.html" or no HTML uploads.
  echo "Syncing HTML to s3://${bucket}/ ..."
  aws s3 sync "${static_dir}/" "s3://${bucket}/" \
    --region "${region}" \
    --cache-control "public, max-age=300, must-revalidate" \
    --exclude "*" \
    --include "*.html"
}

static_s3_upload_extensionless_keys() {
  local static_dir="$1"
  local bucket="$2"
  local region="${3:-us-east-1}"
  local html_file rel route_path count=0

  echo "Uploading extensionless S3 keys for clean URLs (/enter, /demo, …) ..."
  while IFS= read -r html_file; do
    [[ -n "${html_file}" ]] || continue
    rel="${html_file#${static_dir}/}"
    route_path="${rel%/index.html}"
    case "${route_path}" in
    index | 404 | _not-found) continue ;;
    esac
    aws s3 cp "${html_file}" "s3://${bucket}/${route_path}" \
      --content-type "text/html; charset=utf-8" \
      --cache-control "public, max-age=300, must-revalidate" \
      --region "${region}"
    count=$((count + 1))
  done < <(find "${static_dir}" -name index.html -type f)
  echo "Uploaded ${count} extensionless route object(s)."
}

static_s3_write_build_manifest() {
  local static_dir="$1"
  local bucket="$2"
  local region="${3:-us-east-1}"
  local manifest_file
  manifest_file="$(mktemp)"
  local css_json
  css_json="$(static_s3_css_refs_from_html "${static_dir}/index.html" | jq -R -s -c 'split("\n") | map(select(length > 0))')"
  jq -n \
    --arg builtAt "$(date -u +"%Y-%m-%dT%H:%M:%SZ")" \
    --arg source "apps/marketing/out" \
    --arg indexMd5 "$(md5 -q "${static_dir}/index.html" 2>/dev/null || md5sum "${static_dir}/index.html" | awk '{print $1}')" \
    --argjson cssFiles "${css_json}" \
    '{builtAt: $builtAt, source: $source, indexMd5: $indexMd5, cssFiles: $cssFiles}' > "${manifest_file}"
  aws s3 cp "${manifest_file}" "s3://${bucket}/.well-known/marketing-build.json" \
    --content-type "application/json" \
    --cache-control "no-cache, no-store, must-revalidate" \
    --region "${region}"
  rm -f "${manifest_file}"
}

static_s3_object_exists() {
  local bucket="$1"
  local key="$2"
  local region="${3:-us-east-1}"
  aws s3api head-object --bucket "${bucket}" --key "${key}" --region "${region}" >/dev/null 2>&1
}

static_s3_verify_remote_deploy() {
  local static_dir="$1"
  local bucket="$2"
  local region="${3:-us-east-1}"
  shift 3
  local -a required_routes=("$@")

  echo "Post-deploy verification against s3://${bucket}/ ..."

  local remote_index local_index_md5 remote_index_md5 css_file
  remote_index="$(aws s3 cp "s3://${bucket}/index.html" - --region "${region}")"
  if [[ -z "${remote_index}" ]]; then
    echo "ERROR: Remote index.html is empty or missing." >&2
    return 1
  fi

  local_index_md5="$(md5 -q "${static_dir}/index.html" 2>/dev/null || md5sum "${static_dir}/index.html" | awk '{print $1}')"
  remote_index_md5="$(printf '%s' "${remote_index}" | md5 -q 2>/dev/null || printf '%s' "${remote_index}" | md5sum | awk '{print $1}')"
  if [[ "${local_index_md5}" != "${remote_index_md5}" ]]; then
    echo "ERROR: S3 index.html does not match local build (local ${local_index_md5}, remote ${remote_index_md5})." >&2
    echo "HTML may not have synced — aborting before callers assume deploy succeeded." >&2
    return 1
  fi

  while IFS= read -r css_file; do
    [[ -n "${css_file}" ]] || continue
    if ! static_s3_object_exists "${bucket}" "_next/static/css/${css_file}" "${region}"; then
      echo "ERROR: S3 missing CSS object _next/static/css/${css_file} referenced by index.html." >&2
      return 1
    fi
  done < <(static_s3_css_refs_from_html "${static_dir}/index.html")

  local route remote_body
  for route in "${required_routes[@]}"; do
    if ! static_s3_object_exists "${bucket}" "${route}" "${region}"; then
      echo "ERROR: S3 missing extensionless key \"${route}\" (/${route} would fall back to homepage)." >&2
      return 1
    fi
    remote_body="$(aws s3 cp "s3://${bucket}/${route}" - --region "${region}")"
    if [[ "${remote_body}" == "${remote_index}" ]]; then
      echo "ERROR: S3 key \"${route}\" has identical content to index.html (splash/routes broken)." >&2
      return 1
    fi
  done

  echo "Post-deploy verification passed (index.html, CSS objects, extensionless routes)."
}

static_s3_invalidate_cloudfront() {
  local dist_id="$1"
  local region="${2:-us-east-1}"
  echo "Invalidating CloudFront distribution ${dist_id} ..."
  aws cloudfront create-invalidation \
    --distribution-id "${dist_id}" \
    --paths "/*" \
    --region "${region}" >/dev/null
}
