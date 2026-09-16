#!/usr/bin/env bash
# Recreate CAD Bridge HttpApi routes when CloudFormation still tracks
# Route/Integration IDs that were deleted out-of-band (HttpApi replace / drift).
#
# Attaches ANY /api/cad-bridge/{proxy+} and the two public webhook routes to
# stack-2 HttpApi (t4bdwpjfs5). Idempotent: skips RouteKeys that already exist.
set -euo pipefail

export PATH="/usr/bin:/bin:/usr/sbin:/sbin:/opt/homebrew/bin:/usr/local/bin:${PATH}"
export AWS_PROFILE="${AWS_PROFILE:-rapid-cortex}"
export AWS_REGION="${AWS_REGION:-us-east-1}"
export AWS_DEFAULT_REGION="${AWS_DEFAULT_REGION:-$AWS_REGION}"
unset HTTP_PROXY HTTPS_PROXY http_proxy https_proxy ALL_PROXY all_proxy || true

python3 - <<'PY'
from __future__ import annotations

import json
import subprocess

REGION = "us-east-1"
ACCOUNT = "158961537080"
API2 = "t4bdwpjfs5"
AUTH2 = "3ui9q4"

FNS = {
    "http": f"arn:aws:lambda:{REGION}:{ACCOUNT}:function:rapid-cortex-dev-AppSamCadBr-CadBridgeHttpFunction-q1IuObj1quew",
    "webhook": f"arn:aws:lambda:{REGION}:{ACCOUNT}:function:rapid-cortex-dev-AppSamCa-CadBridgeWebhookFunction-jZGx2mGaFca1",
}


def aws(*args: str) -> dict:
    cmd = ["aws", *args, "--region", REGION, "--output", "json"]
    proc = subprocess.run(cmd, capture_output=True, text=True)
    if proc.returncode != 0:
        raise RuntimeError(f"{' '.join(cmd)}\n{proc.stderr}")
    return json.loads(proc.stdout) if proc.stdout.strip() else {}


def integ_uri(fn_arn: str) -> str:
    return f"arn:aws:apigateway:{REGION}:lambda:path/2015-03-31/functions/{fn_arn}/invocations"


def existing_route_keys(api_id: str) -> dict[str, str]:
    items = aws("apigatewayv2", "get-routes", "--api-id", api_id).get("Items") or []
    return {r["RouteKey"]: r["RouteId"] for r in items}


def find_integration(api_id: str, fn_arn: str) -> str | None:
    want = integ_uri(fn_arn)
    items = aws("apigatewayv2", "get-integrations", "--api-id", api_id).get("Items") or []
    for item in items:
        if item.get("IntegrationUri") == want:
            return item["IntegrationId"]
    return None


def create_integration(api_id: str, fn_arn: str) -> str:
    existing = find_integration(api_id, fn_arn)
    if existing:
        print(f"  reuse integration {existing} -> {fn_arn.rsplit(':', 1)[-1]}")
        return existing
    created = aws(
        "apigatewayv2",
        "create-integration",
        "--api-id",
        api_id,
        "--integration-type",
        "AWS_PROXY",
        "--integration-uri",
        integ_uri(fn_arn),
        "--payload-format-version",
        "2.0",
    )
    integration_id = created["IntegrationId"]
    print(f"  integration {integration_id} -> {fn_arn.rsplit(':', 1)[-1]}")
    return integration_id


def create_route(
    api_id: str,
    route_key: str,
    integration_id: str,
    *,
    jwt: bool,
    authorizer: str | None,
    have: dict[str, str],
) -> None:
    if route_key in have:
        print(f"  skip existing {route_key} ({have[route_key]})")
        return
    args = [
        "apigatewayv2",
        "create-route",
        "--api-id",
        api_id,
        "--route-key",
        route_key,
        "--target",
        f"integrations/{integration_id}",
        "--authorization-type",
        "JWT" if jwt else "NONE",
    ]
    if jwt:
        if not authorizer:
            raise RuntimeError("JWT route requires authorizer")
        args += ["--authorizer-id", authorizer]
    created = aws(*args)
    print(f"  route {created['RouteId']} {route_key}")
    have[route_key] = created["RouteId"]


def ensure_invoke_permission(fn_arn: str, api_id: str, sid: str) -> None:
    source = f"arn:aws:execute-api:{REGION}:{ACCOUNT}:{api_id}/*"
    fn_name = fn_arn.rsplit(":", 1)[-1]
    try:
        aws(
            "lambda",
            "add-permission",
            "--function-name",
            fn_name,
            "--statement-id",
            sid,
            "--action",
            "lambda:InvokeFunction",
            "--principal",
            "apigateway.amazonaws.com",
            "--source-arn",
            source,
        )
        print(f"  permission {sid} on {fn_name}")
    except RuntimeError as exc:
        if "ResourceConflictException" in str(exc) or "already exists" in str(exc).lower():
            print(f"  permission {sid} already present")
            return
        raise


print(f"Restoring CAD Bridge HttpApi routes on {API2}")
have = existing_route_keys(API2)
http_id = create_integration(API2, FNS["http"])
webhook_id = create_integration(API2, FNS["webhook"])
create_route(
    API2,
    "ANY /api/cad-bridge/{proxy+}",
    http_id,
    jwt=True,
    authorizer=AUTH2,
    have=have,
)
create_route(
    API2,
    "POST /api/public/cad-bridge/{agencyId}/cad-a/events",
    webhook_id,
    jwt=False,
    authorizer=None,
    have=have,
)
create_route(
    API2,
    "POST /api/public/cad-bridge/{agencyId}/cad-b/events",
    webhook_id,
    jwt=False,
    authorizer=None,
    have=have,
)

print("\n=== Lambda invoke permissions ===")
ensure_invoke_permission(FNS["http"], API2, "HttpApi2CadBridgeHttpInvoke")
ensure_invoke_permission(FNS["webhook"], API2, "HttpApi2CadBridgeWebhookInvoke")
print("\nDone.")
PY
