#!/usr/bin/env bash
# Send www.nexcortiq.us/c and /card to the production web app.
#
# The marketing distribution serves a static site. Those two paths have no
# objects, so CloudFront was returning the homepage. Extra cache behaviors
# forward them to the web ALB. App middleware then redirects the browser to
# https://app.rapidcortex.us so scripts and Save Contact stay on the app.
#
# The deploy role can update this distribution. It cannot publish CloudFront
# Functions, so this behavior is the live route.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck source=scripts/lib/rapid-cortex-aws.sh
source "${ROOT}/scripts/lib/rapid-cortex-aws.sh"

export AWS_PROFILE="${AWS_PROFILE:-rapid-cortex}"
export AWS_REGION="${AWS_REGION:-us-east-1}"
rapid_cortex_assert_aws_account

DIST_ID="${MARKETING_CF_DIST_ID:-${RAPID_CORTEX_MARKETING_CF_DIST_ID}}"
ALB_DOMAIN="${WEB_ALB_DOMAIN:-rapid-cortex-v2-web-prod-980967682.us-east-1.elb.amazonaws.com}"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "${TMP_DIR}"' EXIT

aws cloudfront get-distribution-config --id "${DIST_ID}" >"${TMP_DIR}/dist.json"
ETAG="$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["ETag"])' "${TMP_DIR}/dist.json")"

python3 - "${TMP_DIR}/dist.json" "${ALB_DOMAIN}" "${TMP_DIR}/config.json" <<'PY'
import json, sys
src, alb, out = sys.argv[1:4]
cfg = json.load(open(src))["DistributionConfig"]
origin_id = "ContactCardApp"
origins = cfg["Origins"]["Items"]
if not any(item["Id"] == origin_id for item in origins):
    origins.append({
        "Id": origin_id,
        "DomainName": alb,
        "OriginPath": "",
        "CustomHeaders": {"Quantity": 0},
        "CustomOriginConfig": {
            "HTTPPort": 80,
            "HTTPSPort": 443,
            "OriginProtocolPolicy": "http-only",
            "OriginSslProtocols": {"Quantity": 2, "Items": ["SSLv3", "TLSv1"]},
            "OriginReadTimeout": 60,
            "OriginKeepaliveTimeout": 5,
        },
        "ConnectionAttempts": 3,
        "ConnectionTimeout": 10,
        "OriginShield": {"Enabled": False},
        "OriginAccessControlId": "",
    })
    cfg["Origins"]["Quantity"] = len(origins)

behaviors = cfg.setdefault("CacheBehaviors", {"Quantity": 0, "Items": []})
items = behaviors.setdefault("Items", [])
existing = {item["PathPattern"] for item in items}

def behavior(pattern):
    return {
        "PathPattern": pattern,
        "TargetOriginId": origin_id,
        "TrustedSigners": {"Enabled": False, "Quantity": 0},
        "TrustedKeyGroups": {"Enabled": False, "Quantity": 0},
        "ViewerProtocolPolicy": "redirect-to-https",
        "AllowedMethods": {
            "Quantity": 3,
            "Items": ["HEAD", "GET", "OPTIONS"],
            "CachedMethods": {"Quantity": 2, "Items": ["HEAD", "GET"]},
        },
        "SmoothStreaming": False,
        "Compress": True,
        "LambdaFunctionAssociations": {"Quantity": 0},
        "FunctionAssociations": {"Quantity": 0},
        "FieldLevelEncryptionId": "",
        "CachePolicyId": "4135ea2d-6df8-44a3-9df3-4b5a84be39ad",
        "OriginRequestPolicyId": "216adef6-5c7f-47e4-b989-5492eafa07d3",
        "ResponseHeadersPolicyId": "8b6fdc84-ee5c-4602-ac77-34116aa6fdd2",
        "GrpcConfig": {"Enabled": False},
    }

# First match wins. Keep contact-card patterns ahead of the static default.
front = [behavior(pattern) for pattern in ("/c", "/c/*", "/card", "/card/*") if pattern not in existing]
behaviors["Items"] = front + items
behaviors["Quantity"] = len(behaviors["Items"])
json.dump(cfg, open(out, "w"))
print(f"behaviors={behaviors['Quantity']} added={len(front)}")
PY

aws cloudfront update-distribution \
  --id "${DIST_ID}" \
  --if-match "${ETAG}" \
  --distribution-config "file://${TMP_DIR}/config.json" \
  --query 'Distribution.{Id:Id,Status:Status}' \
  --output json

aws cloudfront create-invalidation --distribution-id "${DIST_ID}" \
  --paths "/c" "/c/*" "/card" "/card/*" \
  --query 'Invalidation.Id' --output text
