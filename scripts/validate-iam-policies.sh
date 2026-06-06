#!/usr/bin/env bash
# CJIS: CI guard for IAM wildcards in infra/template.yaml and infra/iam/*.json
#  - Fails on Action: "*" or "service:*" in template Lambda policies
#  - Allows Resource: "*" only in documented service blocks (Comprehend, Translate, Pinpoint SMS-Voice, Cognito
#    control-plane) or when a regional Condition is present on the same statement object (best-effort YAML scan).
#  - Fails on foundation-model/* (must use explicit model id parameters)
set -euo pipefail
ROOT=$(cd "$(dirname "$0")/.." && pwd)
python3 - "$ROOT" <<'PY'
import re
import sys
import json
from pathlib import Path

root = Path(sys.argv[1])
fail = False
template = root / "infra" / "template.yaml"
text = template.read_text(encoding="utf-8")
lines = text.splitlines()

# Disallow service-wide ("dynamodb:*", "lambda:*", …) in explicit YAML policies
for i, line in enumerate(lines, start=1):
    if re.search(r"^\s*Action:\s*\*\s*$", line):
        print(f"BLOCKED: {template}:{i}: Action * {line.strip()!r}")
        fail = True
    if re.search(r"^\s*-\s*[\"']?([a-z0-9-]+):\*\s*[\"']?\s*$", line):
        print(f"BLOCKED: {template}:{i}: service-wide Action {line.strip()!r}")
        fail = True

# foundation-model/* anywhere
if "foundation-model/*" in text or "foundation-model\\*" in text:
    print(f"BLOCKED: {template}: uses foundation-model/* Bedrock wildcard (use explicit model id ARNs).")
    fail = True

# Resource: * lines — require nearby allowlist keyword or "Condition:" with aws:RequestedRegion after Resource line
for i, line in enumerate(lines, start=1):
    if not re.match(r"^\s*Resource:\s*[\"']?\*[\"']?\s*$", line):
        continue
    # Include following lines: YAML often places Condition after Resource.
    window = "\n".join(lines[max(0, i - 25) : i + 12])
    allowed = any(
        k in window
        for k in (
            "comprehend:DetectDominantLanguage",
            "translate:TranslateText",
            "sms-voice:Describe",
        )
    )
    has_region_lock = "aws:RequestedRegion" in window and "Condition" in window
    if allowed or (has_region_lock and ("comprehend" in window or "translate" in window or "sms-voice" in window)):
        continue
    if has_region_lock and "kinesisvideo:Create" in window:
        continue
    if "CORS" in window or "AllowedOrigins" in window or "AllowedHeaders" in window:
        continue
    print(f"BLOCKED: {template}:{i}: Resource * must be allowlisted (add scoped ARN) or be Comprehend/Translate/SMS-Voice with regional Condition. Context:\n{window[-400:]}")
    fail = True

# sam-deploy-policy.json: only known Sids may use "Resource": "*"
deploy = (root / "infra" / "iam" / "sam-deploy-policy.json").read_text(encoding="utf-8")
allowed_sids = {
    "CloudFormationDiscovery",
    "Route53GlobalReads",
    "AcmRequestCertificate",
    "CloudFrontWebHosting",
    "SesEmailIdentities",
    "ApplicationAutoScalingDynamo",
}
d = json.loads(deploy)
for stmt in d.get("Statement", []):
    if stmt.get("Resource") == "*":
        sid = stmt.get("Sid", "")
        if sid not in allowed_sids:
            print(f"BLOCKED: sam-deploy-policy.json Sid {sid!r} uses Resource * (must be one of {allowed_sids} or add Sid + review).")
            fail = True

if fail:
    print("validate-iam-policies: FAILED")
    sys.exit(1)
print("validate-iam-policies: ok")
PY
