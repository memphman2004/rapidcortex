#!/usr/bin/env python3
"""P0 production go/no-go checks that can be proven from the repo.

MFA, session lifetime, refresh revocation, and private media buckets are
verified from templates and the 2026-09-17 Cognito capture. Rollback and
backup/restore stay open until a drill writes its own artifact. This script
does not invent those artifacts.
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BUCKET_TYPE = re.compile(r"""(?:Type:\s*AWS::S3::Bucket\s*$|"Type": "AWS::S3::Bucket")""")
PUBLIC_FLAGS = (
    "BlockPublicAcls",
    "BlockPublicPolicy",
    "IgnorePublicAcls",
    "RestrictPublicBuckets",
)


def fail(message: str, errors: list[str]) -> None:
    errors.append(message)


def check_mfa(errors: list[str]) -> None:
    pool = (ROOT / "infra/nested/stack-app-sam.yaml").read_text()
    if 'MfaConfiguration: "ON"' not in pool or "SOFTWARE_TOKEN_MFA" not in pool:
        fail("Cognito user pool is not TOTP-required (MfaConfiguration ON + SOFTWARE_TOKEN_MFA).", errors)
    capture = (
        ROOT
        / "docs/evidence/2026-09-17-soc2-technical-controls/raw/20260917T210339Z-08-cognito-mfa-config-us-east-1_IoBei9vlD.json"
    )
    if not capture.is_file():
        fail(f"MFA evidence capture missing: {capture.relative_to(ROOT)}", errors)
        return
    data = json.loads(capture.read_text())
    if data.get("MfaConfiguration") != "ON":
        fail("MFA evidence capture does not show MfaConfiguration ON.", errors)
    enabled = (data.get("SoftwareTokenMfaConfiguration") or {}).get("Enabled")
    if enabled is not True:
        fail("MFA evidence capture does not show software-token MFA enabled.", errors)


def check_session(errors: list[str]) -> None:
    pool = (ROOT / "infra/nested/stack-app-sam.yaml").read_text()
    if pool.count("IdTokenValidity: 30") < 2 or pool.count("RefreshTokenValidity: 12") < 2:
        fail("Both Cognito app clients need IdTokenValidity 30 minutes and RefreshTokenValidity 12 hours.", errors)
    signout = (ROOT / "apps/web/app/api/auth/signout/route.ts").read_text()
    if "revokeRefreshToken" not in signout:
        fail("Sign-out does not revoke the Cognito refresh token.", errors)
    context = (ROOT / "apps/web/components/auth/session-context.tsx").read_text()
    if "initSessionTimeout" not in context:
        fail("Session context does not start the idle timeout.", errors)


def check_media(errors: list[str]) -> None:
    nested = ROOT / "infra" / "nested"
    for path in sorted(nested.glob("stack-*.yaml")):
        if ".before" in path.name:
            continue
        lines = path.read_text().splitlines()
        for index, line in enumerate(lines):
            if not BUCKET_TYPE.search(line):
                continue
            window = "\n".join(lines[index : index + 80])
            for flag in PUBLIC_FLAGS:
                if not re.search(rf"{flag}\s*:\s*true", window) and f'"{flag}": true' not in window:
                    fail(f"{path.relative_to(ROOT)}:{index + 1} bucket missing {flag}: true", errors)


def check_drills(errors: list[str]) -> None:
    completed = False
    for path in (ROOT / "docs" / "evidence").rglob("*-restore-completed.json"):
        try:
            body = json.loads(path.read_text())
        except json.JSONDecodeError:
            continue
        table = (body.get("Table") or {}).get("TableStatus")
        if table == "ACTIVE" and body.get("sourceItemCount") is not None and body.get("restoredItemCount") is not None:
            completed = True
    if not completed:
        fail(
            "Backup/restore is not complete. docs/evidence/soc2-evidence/2026-09/restore-drill/"
            "20260919T014227Z-restore-started.json shows rapid-cortex-audit-dev-restore-20260919 "
            "still CREATING, with no item-count check. After the table is ACTIVE, save "
            "*-restore-completed.json with Table.TableStatus ACTIVE, sourceItemCount, and restoredItemCount.",
            errors,
        )
    rollback_dir = ROOT / "docs" / "evidence" / "p0" / "rollback"
    has_log = False
    has_screenshot = False
    if rollback_dir.is_dir():
        for path in rollback_dir.iterdir():
            if path.suffix.lower() in {".png", ".jpg", ".jpeg", ".webp"} and path.stat().st_size > 0:
                has_screenshot = True
            if path.suffix.lower() != ".json":
                continue
            try:
                body = json.loads(path.read_text())
            except json.JSONDecodeError:
                continue
            if body.get("result") == "PASS" and body.get("date"):
                has_log = True
    if not (has_log and has_screenshot):
        fail(
            "Rollback drill evidence is missing. Run scripts/fire-drill-rollback.sh in the target "
            "environment and save both a screenshot and "
            "{\"result\":\"PASS\",\"date\":\"YYYY-MM-DD\"} under docs/evidence/p0/rollback/.",
            errors,
        )


def main() -> int:
    errors: list[str] = []
    check_mfa(errors)
    check_session(errors)
    check_media(errors)
    check_drills(errors)
    if errors:
        print("P0 go/no-go gate failed:", file=sys.stderr)
        for item in errors:
            print(f"  - {item}", file=sys.stderr)
        return 1
    print("P0 go/no-go gate passed (MFA capture, session revocation, private buckets, drill artifacts).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
