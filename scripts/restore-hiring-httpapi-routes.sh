#!/usr/bin/env bash
# Recreate Careers + Hiring ATS HttpApi routes when CloudFormation still tracks
# Route/Integration IDs that were deleted out-of-band (HttpApi replace).
#
# Attaches the canonical set to HttpApi3 (tbr4zvjlk5) and also attaches the three
# JWT admin APIs to HttpApi1 (k26yw4o3xk / api.rapidcortex.us) so a live ECS build
# that still proxies /api/rc-admin/applications to stack 1 keeps working.
#
# Idempotent: skips RouteKeys that already exist.
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
import sys

REGION = "us-east-1"
ACCOUNT = "158961537080"
API3 = "tbr4zvjlk5"
API1 = "k26yw4o3xk"
AUTH3 = "k8rjdh"
AUTH1 = "pg3ok4"

FNS = {
    "job": f"arn:aws:lambda:{REGION}:{ACCOUNT}:function:rapid-cortex-dev-AppSamHi-RcAdminJobPostingsHttpFu-TrVct6tbxSey",
    "apps": f"arn:aws:lambda:{REGION}:{ACCOUNT}:function:rapid-cortex-dev-AppSamHi-RcAdminApplicationsHttpF-iSzNeAOhfzKY",
    "bookings": f"arn:aws:lambda:{REGION}:{ACCOUNT}:function:rapid-cortex-dev-AppSamHi-RcAdminHiringBookingsHtt-onLpS1XyQVPX",
    "postings": f"arn:aws:lambda:{REGION}:{ACCOUNT}:function:rapid-cortex-dev-AppSamHir-CareersPostingsFunction-DO9zwRLczMbL",
    "apply": f"arn:aws:lambda:{REGION}:{ACCOUNT}:function:rapid-cortex-dev-AppSamHiring-CareersApplyFunction-66bln3HcbRkv",
    "presign": f"arn:aws:lambda:{REGION}:{ACCOUNT}:function:rapid-cortex-dev-AppSamHi-CareersPresignedUploadFu-9uwgiHwzkvHZ",
}


def aws(*args: str) -> dict:
    cmd = ["aws", *args, "--region", REGION, "--output", "json"]
    proc = subprocess.run(cmd, capture_output=True, text=True)
    if proc.returncode != 0:
        raise RuntimeError(f"{' '.join(cmd)}\n{proc.stderr}")
    return json.loads(proc.stdout) if proc.stdout.strip() else {}


def aws_text(*args: str) -> str:
    cmd = ["aws", *args, "--region", REGION, "--output", "text"]
    proc = subprocess.run(cmd, capture_output=True, text=True)
    if proc.returncode != 0:
        raise RuntimeError(f"{' '.join(cmd)}\n{proc.stderr}")
    return proc.stdout.strip()


def integ_uri(fn_arn: str) -> str:
    return f"arn:aws:apigateway:{REGION}:lambda:path/2015-03-31/functions/{fn_arn}/invocations"


def existing_route_keys(api_id: str) -> dict[str, str]:
    items = aws("apigatewayv2", "get-routes", "--api-id", api_id).get("Items") or []
    return {r["RouteKey"]: r["RouteId"] for r in items}


def create_integration(api_id: str, fn_arn: str) -> str:
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


def create_route(api_id: str, route_key: str, integration_id: str, *, jwt: bool, authorizer: str | None, have: dict[str, str]) -> None:
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


JWT_JOB = [
    "GET /api/rc-admin/job-postings",
    "POST /api/rc-admin/job-postings",
    "GET /api/rc-admin/job-postings/{postingId}",
    "PUT /api/rc-admin/job-postings/{postingId}",
    "PATCH /api/rc-admin/job-postings/{postingId}",
]
JWT_APPS = [
    "GET /api/rc-admin/applications",
    "GET /api/rc-admin/applications/{applicationId}",
    "PUT /api/rc-admin/applications/{applicationId}",
    "PATCH /api/rc-admin/applications/{applicationId}",
    "POST /api/rc-admin/applications/{applicationId}/notes",
    "GET /api/rc-admin/applications/{applicationId}/resume-url",
]
JWT_BOOKINGS = [
    "GET /api/rc-admin/settings/hiring-bookings",
    "PUT /api/rc-admin/settings/hiring-bookings",
]
PUBLIC_POSTINGS = [
    ("GET /api/careers/postings", False),
    ("OPTIONS /api/careers/postings", False),
    ("GET /api/careers/postings/{slug}", False),
    ("OPTIONS /api/careers/postings/{slug}", False),
]
PUBLIC_APPLY = [
    ("POST /api/careers/apply", False),
    ("OPTIONS /api/careers/apply", False),
]
PUBLIC_PRESIGN = [
    ("POST /api/careers/presigned-upload", False),
    ("OPTIONS /api/careers/presigned-upload", False),
]


def attach_admin(api_id: str, authorizer: str) -> None:
    print(f"\n=== {api_id} admin routes ===")
    have = existing_route_keys(api_id)
    job_id = create_integration(api_id, FNS["job"])
    apps_id = create_integration(api_id, FNS["apps"])
    bookings_id = create_integration(api_id, FNS["bookings"])
    for key in JWT_JOB:
        create_route(api_id, key, job_id, jwt=True, authorizer=authorizer, have=have)
    for key in JWT_APPS:
        create_route(api_id, key, apps_id, jwt=True, authorizer=authorizer, have=have)
    for key in JWT_BOOKINGS:
        create_route(api_id, key, bookings_id, jwt=True, authorizer=authorizer, have=have)


def attach_careers(api_id: str) -> None:
    print(f"\n=== {api_id} careers routes ===")
    have = existing_route_keys(api_id)
    postings_id = create_integration(api_id, FNS["postings"])
    apply_id = create_integration(api_id, FNS["apply"])
    presign_id = create_integration(api_id, FNS["presign"])
    for key, jwt in PUBLIC_POSTINGS:
        create_route(api_id, key, postings_id, jwt=jwt, authorizer=None, have=have)
    for key, jwt in PUBLIC_APPLY:
        create_route(api_id, key, apply_id, jwt=jwt, authorizer=None, have=have)
    for key, jwt in PUBLIC_PRESIGN:
        create_route(api_id, key, presign_id, jwt=jwt, authorizer=None, have=have)


print("Restoring hiring/careers HttpApi routes")
attach_admin(API3, AUTH3)
attach_careers(API3)
attach_admin(API1, AUTH1)

print("\n=== Lambda invoke permissions for HttpApi1 ===")
ensure_invoke_permission(FNS["job"], API1, "HttpApi1HiringJobPostingsInvoke")
ensure_invoke_permission(FNS["apps"], API1, "HttpApi1HiringApplicationsInvoke")
ensure_invoke_permission(FNS["bookings"], API1, "HttpApi1HiringBookingsInvoke")

print("\nDone.")
PY
