#!/usr/bin/env python3
"""AWS CJIS environment validation checker.

Validates critical control posture for dev/staging/pilot/prod and exports:
- machine-readable JSON report
- human-readable HTML report
- raw AWS evidence payloads per check
- append-only validation history
"""

from __future__ import annotations

import argparse
import datetime as dt
import json
import os
import sys
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

try:
    import boto3
    from botocore.exceptions import BotoCoreError, ClientError
except Exception as exc:  # pragma: no cover - import guard
    raise SystemExit(
        "Missing boto3/botocore. Install with: pip install boto3\n"
        f"Import error: {exc}"
    )


ENV_DEV = "development"
ENV_STAGING = "staging"
ENV_PILOT = "pilot"
ENV_PROD = "production"
ALLOWED_ENVS = {ENV_DEV, ENV_STAGING, ENV_PILOT, ENV_PROD}

STRICT_ENVS = {ENV_PILOT, ENV_PROD}
MODERATE_ENVS = {ENV_STAGING}

SEVERITY_INFO = "info"
SEVERITY_WARN = "warning"
SEVERITY_FAIL = "failure"


@dataclass
class Remediation:
    summary: str
    console_steps: List[str]
    iac_path: str
    eta: str


@dataclass
class CheckResult:
    check_id: str
    title: str
    service: str
    severity: str
    passed: bool
    environment: str
    details: str
    evidence_file: str
    remediation: Remediation


class ValidationChecker:
    def __init__(
        self,
        environment: str,
        region: str,
        stage_hint: str,
        report_dir: Path,
        profile: Optional[str] = None,
    ) -> None:
        if environment not in ALLOWED_ENVS:
            raise ValueError(f"Invalid environment '{environment}'. Expected one of: {sorted(ALLOWED_ENVS)}")
        self.environment = environment
        self.region = region
        self.stage_hint = stage_hint.lower()
        self.report_dir = report_dir
        self.evidence_dir = report_dir / "evidence"
        self.evidence_dir.mkdir(parents=True, exist_ok=True)
        self.session = boto3.Session(profile_name=profile, region_name=region)
        self.started_at = dt.datetime.now(dt.timezone.utc)
        self.results: List[CheckResult] = []

    def run(self) -> Dict[str, Any]:
        self._check_waf()
        self._check_cors()
        self._check_kms()
        self._check_cloudtrail()
        self._check_s3_encryption()
        self._check_dynamodb_encryption()
        self._check_vpc_flow_logs()
        self._check_security_group_ingress()
        self._check_iam_password_policy()
        return self._build_report()

    def _is_strict(self) -> bool:
        return self.environment in STRICT_ENVS

    def _is_moderate_or_strict(self) -> bool:
        return self.environment in STRICT_ENVS or self.environment in MODERATE_ENVS

    def _record(
        self,
        *,
        check_id: str,
        title: str,
        service: str,
        passed: bool,
        details: str,
        evidence: Dict[str, Any],
        remediation: Remediation,
    ) -> None:
        severity = SEVERITY_INFO
        if not passed:
            severity = SEVERITY_WARN if self.environment == ENV_DEV else SEVERITY_FAIL
            if self.environment == ENV_STAGING:
                severity = SEVERITY_WARN
        evidence_file = f"{check_id}.json"
        with (self.evidence_dir / evidence_file).open("w", encoding="utf-8") as fp:
            json.dump(evidence, fp, indent=2, default=str)
        self.results.append(
            CheckResult(
                check_id=check_id,
                title=title,
                service=service,
                severity=severity,
                passed=passed,
                environment=self.environment,
                details=details,
                evidence_file=str(Path("evidence") / evidence_file),
                remediation=remediation,
            )
        )

    def _safe_call(self, fn, *args, **kwargs) -> Tuple[bool, Dict[str, Any], str]:
        try:
            response = fn(*args, **kwargs)
            return True, response if isinstance(response, dict) else {"response": response}, ""
        except (ClientError, BotoCoreError) as err:
            return False, {}, f"{type(err).__name__}: {err}"

    def _check_waf(self) -> None:
        apig = self.session.client("apigatewayv2")
        waf = self.session.client("wafv2")
        ok_apis, apis, api_error = self._safe_call(apig.get_apis)
        evidence: Dict[str, Any] = {"apis": apis.get("Items", []), "api_error": api_error, "associations": []}
        associated = 0
        if ok_apis:
            for api in apis.get("Items", []):
                api_id = api.get("ApiId")
                if not api_id:
                    continue
                resource_arn = (
                    f"arn:aws:apigateway:{self.region}::/apis/{api_id}/stages/{self.stage_hint}"
                )
                ok_assoc, assoc, assoc_error = self._safe_call(waf.get_web_acl_for_resource, ResourceArn=resource_arn)
                evidence["associations"].append(
                    {"apiId": api_id, "resourceArn": resource_arn, "associated": ok_assoc, "error": assoc_error, "raw": assoc}
                )
                if ok_assoc and assoc.get("WebACL"):
                    associated += 1
        passed = associated > 0 or not self._is_moderate_or_strict()
        self._record(
            check_id="waf_association",
            title="WAF association on API Gateway",
            service="wafv2/apigatewayv2",
            passed=passed,
            details=f"Found {associated} API stages with associated web ACL.",
            evidence=evidence,
            remediation=Remediation(
                summary="Associate WAF web ACL with API Gateway stage.",
                console_steps=[
                    "Open AWS WAF > Web ACLs and create/select a CJIS policy ACL.",
                    "Open API Gateway > target API > Stage settings.",
                    "Attach the web ACL to the stage and redeploy if prompted.",
                    "Re-run this validator and verify association evidence appears.",
                ],
                iac_path="infra/template.yaml",
                eta="30-60 minutes",
            ),
        )

    def _check_cors(self) -> None:
        apig = self.session.client("apigatewayv2")
        ok, payload, error = self._safe_call(apig.get_apis)
        wildcard_found = False
        cors_data: List[Dict[str, Any]] = []
        if ok:
            for api in payload.get("Items", []):
                api_id = api.get("ApiId")
                if not api_id:
                    continue
                ok_api, api_detail, api_error = self._safe_call(apig.get_api, ApiId=api_id)
                allow_origins: List[str] = []
                if ok_api:
                    allow_origins = api_detail.get("CorsConfiguration", {}).get("AllowOrigins", []) or []
                    if "*" in allow_origins:
                        wildcard_found = True
                cors_data.append({"apiId": api_id, "allowOrigins": allow_origins, "error": api_error})
        passed = (not wildcard_found) or self.environment == ENV_DEV
        self._record(
            check_id="cors_origin_policy",
            title="CORS wildcard disabled outside development",
            service="apigatewayv2",
            passed=passed,
            details="Wildcard origin found." if wildcard_found else "No wildcard CORS origins detected.",
            evidence={"apis": cors_data, "error": error},
            remediation=Remediation(
                summary="Replace wildcard CORS origins with explicit approved origins.",
                console_steps=[
                    "Open API Gateway > target API > CORS.",
                    "Replace '*' with explicit deployment domain origins.",
                    "Save and deploy API stage.",
                    "Verify app/web domains align with environment allowlist.",
                ],
                iac_path="infra/template.yaml (HttpApiCorsAllowedOrigins parameter)",
                eta="15-30 minutes",
            ),
        )

    def _check_kms(self) -> None:
        kms = self.session.client("kms")
        ok, keys_payload, error = self._safe_call(kms.list_keys)
        key_count = 0
        non_rotating = 0
        policy_issues = 0
        key_summaries: List[Dict[str, Any]] = []
        if ok:
            for key in keys_payload.get("Keys", []):
                key_id = key.get("KeyId")
                if not key_id:
                    continue
                key_count += 1
                ok_desc, desc, desc_error = self._safe_call(kms.describe_key, KeyId=key_id)
                ok_rot, rot, _ = self._safe_call(kms.get_key_rotation_status, KeyId=key_id)
                ok_pol, pol, _ = self._safe_call(kms.get_key_policy, KeyId=key_id, PolicyName="default")
                rotation_enabled = bool(rot.get("KeyRotationEnabled")) if ok_rot else False
                policy_text = pol.get("Policy", "") if ok_pol else ""
                policy_ok = '"Principal":"*"' not in policy_text and '"Action":"kms:*"' not in policy_text
                if not rotation_enabled:
                    non_rotating += 1
                if not policy_ok:
                    policy_issues += 1
                key_summaries.append(
                    {
                        "keyId": key_id,
                        "describeError": desc_error,
                        "enabled": desc.get("KeyMetadata", {}).get("Enabled") if ok_desc else None,
                        "rotationEnabled": rotation_enabled,
                        "policyLooksRestricted": policy_ok,
                    }
                )
        if self.environment == ENV_DEV:
            passed = key_count > 0
        elif self.environment == ENV_STAGING:
            passed = key_count > 0 and policy_issues == 0
        else:
            passed = key_count > 0 and policy_issues == 0 and non_rotating == 0
        self._record(
            check_id="kms_key_posture",
            title="KMS keys exist with restricted policy and rotation",
            service="kms",
            passed=passed,
            details=f"keys={key_count}, nonRotating={non_rotating}, policyIssues={policy_issues}",
            evidence={"keys": key_summaries, "error": error},
            remediation=Remediation(
                summary="Harden KMS key policy and enable rotation for managed keys.",
                console_steps=[
                    "Open KMS > Customer managed keys.",
                    "For each key, edit key policy to remove wildcard principals/actions.",
                    "Enable automatic annual key rotation.",
                    "Ensure API/Lambda/S3/Dynamo resources reference these keys.",
                ],
                iac_path="infra/template.yaml (KMS resources + table/bucket encryption refs)",
                eta="30-90 minutes",
            ),
        )

    def _check_cloudtrail(self) -> None:
        cloudtrail = self.session.client("cloudtrail")
        ok, trails, error = self._safe_call(cloudtrail.describe_trails, includeShadowTrails=False)
        active = 0
        statuses: List[Dict[str, Any]] = []
        if ok:
            for trail in trails.get("trailList", []):
                name = trail.get("Name")
                if not name:
                    continue
                ok_status, status, status_error = self._safe_call(cloudtrail.get_trail_status, Name=name)
                is_logging = bool(status.get("IsLogging")) if ok_status else False
                if is_logging:
                    active += 1
                statuses.append({"name": name, "isLogging": is_logging, "error": status_error, "status": status})
        passed = active > 0 or self.environment == ENV_DEV
        self._record(
            check_id="cloudtrail_logging",
            title="CloudTrail trail active and logging",
            service="cloudtrail",
            passed=passed,
            details=f"Active logging trails: {active}",
            evidence={"trails": statuses, "error": error},
            remediation=Remediation(
                summary="Enable at least one org/account trail with active logging.",
                console_steps=[
                    "Open CloudTrail > Trails.",
                    "Create or select account trail and enable logging.",
                    "Enable management events for read/write and global service events.",
                    "Verify trail delivery to encrypted S3 bucket.",
                ],
                iac_path="infra/template.yaml (CloudTrail resources if codified; otherwise platform baseline stack)",
                eta="20-45 minutes",
            ),
        )

    def _check_s3_encryption(self) -> None:
        s3 = self.session.client("s3")
        ok, buckets, error = self._safe_call(s3.list_buckets)
        unencrypted: List[str] = []
        details: List[Dict[str, Any]] = []
        if ok:
            for bucket in buckets.get("Buckets", []):
                name = bucket.get("Name")
                if not name:
                    continue
                ok_enc, enc, enc_error = self._safe_call(s3.get_bucket_encryption, Bucket=name)
                encrypted = ok_enc and bool(enc.get("ServerSideEncryptionConfiguration"))
                if not encrypted:
                    unencrypted.append(name)
                details.append({"bucket": name, "encrypted": encrypted, "error": enc_error})
        passed = len(unencrypted) == 0 or (self.environment == ENV_DEV and len(unencrypted) <= 1)
        self._record(
            check_id="s3_bucket_encryption",
            title="S3 buckets enforce server-side encryption",
            service="s3",
            passed=passed,
            details=f"Unencrypted buckets: {len(unencrypted)}",
            evidence={"buckets": details, "error": error},
            remediation=Remediation(
                summary="Enable bucket default encryption (prefer SSE-KMS).",
                console_steps=[
                    "Open S3 > Bucket > Properties > Default encryption.",
                    "Set SSE-KMS using approved key.",
                    "Apply bucket policy to deny unencrypted object uploads.",
                    "Re-run validation to capture encryption evidence.",
                ],
                iac_path="infra/template.yaml (AssetsBucket + policies)",
                eta="15-45 minutes",
            ),
        )

    def _check_dynamodb_encryption(self) -> None:
        ddb = self.session.client("dynamodb")
        ok, tables, error = self._safe_call(ddb.list_tables)
        non_compliant: List[str] = []
        details: List[Dict[str, Any]] = []
        if ok:
            for table_name in tables.get("TableNames", []):
                ok_desc, desc, desc_error = self._safe_call(ddb.describe_table, TableName=table_name)
                sse = desc.get("Table", {}).get("SSEDescription", {}) if ok_desc else {}
                status = sse.get("Status")
                kms_arn = sse.get("KMSMasterKeyArn")
                encrypted = status in {"ENABLED", "UPDATING"}
                if self._is_strict() and not kms_arn:
                    encrypted = False
                if not encrypted:
                    non_compliant.append(table_name)
                details.append(
                    {"table": table_name, "sseStatus": status, "kmsMasterKeyArn": kms_arn, "error": desc_error}
                )
        passed = len(non_compliant) == 0 or (self.environment == ENV_DEV and len(non_compliant) <= 1)
        self._record(
            check_id="dynamodb_sse",
            title="DynamoDB tables encrypted at rest",
            service="dynamodb",
            passed=passed,
            details=f"Non-compliant tables: {len(non_compliant)}",
            evidence={"tables": details, "error": error},
            remediation=Remediation(
                summary="Enable DynamoDB SSE with KMS for all CJIS-bearing tables.",
                console_steps=[
                    "Open DynamoDB > Table > Additional settings > Encryption at rest.",
                    "Switch to KMS customer managed key for sensitive environments.",
                    "Update IaC template to provision/attach approved KMS key.",
                    "Confirm table status becomes ENABLED.",
                ],
                iac_path="infra/template.yaml (DynamoDB table resources)",
                eta="30-60 minutes",
            ),
        )

    def _check_vpc_flow_logs(self) -> None:
        ec2 = self.session.client("ec2")
        ok_vpcs, vpcs, err_vpcs = self._safe_call(ec2.describe_vpcs)
        flow_logs: List[Dict[str, Any]] = []
        covered = 0
        if ok_vpcs:
            for vpc in vpcs.get("Vpcs", []):
                vpc_id = vpc.get("VpcId")
                if not vpc_id:
                    continue
                ok_logs, logs, err_logs = self._safe_call(
                    ec2.describe_flow_logs, Filter=[{"Name": "resource-id", "Values": [vpc_id]}]
                )
                count = len(logs.get("FlowLogs", [])) if ok_logs else 0
                if count > 0:
                    covered += 1
                flow_logs.append({"vpcId": vpc_id, "flowLogCount": count, "error": err_logs})
        passed = covered > 0 or self.environment == ENV_DEV
        self._record(
            check_id="vpc_flow_logs",
            title="VPC flow logs enabled",
            service="ec2",
            passed=passed,
            details=f"VPCs with flow logs: {covered}",
            evidence={"vpcs": flow_logs, "error": err_vpcs},
            remediation=Remediation(
                summary="Enable VPC flow logs to CloudWatch/S3 for network auditability.",
                console_steps=[
                    "Open VPC > Your VPCs > select VPC > Flow logs.",
                    "Create flow logs for ACCEPT/REJECT traffic.",
                    "Send to encrypted CloudWatch Logs or S3.",
                    "Set retention and access controls for log destination.",
                ],
                iac_path="infra/template.yaml or baseline network stack",
                eta="20-40 minutes",
            ),
        )

    def _check_security_group_ingress(self) -> None:
        ec2 = self.session.client("ec2")
        ok, payload, error = self._safe_call(ec2.describe_security_groups)
        offending: List[Dict[str, Any]] = []
        sensitive_ports = {22, 3389, 5432, 3306, 27017}
        if ok:
            for sg in payload.get("SecurityGroups", []):
                for perm in sg.get("IpPermissions", []):
                    from_port = perm.get("FromPort")
                    to_port = perm.get("ToPort")
                    cidrs = [r.get("CidrIp") for r in perm.get("IpRanges", []) if r.get("CidrIp")]
                    if "0.0.0.0/0" not in cidrs:
                        continue
                    if from_port is None or to_port is None:
                        continue
                    exposed_sensitive = any(p in sensitive_ports for p in range(from_port, to_port + 1))
                    if exposed_sensitive:
                        offending.append(
                            {
                                "groupId": sg.get("GroupId"),
                                "groupName": sg.get("GroupName"),
                                "fromPort": from_port,
                                "toPort": to_port,
                                "cidr": "0.0.0.0/0",
                            }
                        )
        passed = len(offending) == 0
        self._record(
            check_id="security_group_ingress",
            title="No world-open sensitive security group ports",
            service="ec2",
            passed=passed,
            details=f"Offending rules: {len(offending)}",
            evidence={"offendingRules": offending, "error": error},
            remediation=Remediation(
                summary="Restrict sensitive port ingress to known source CIDRs or SG references.",
                console_steps=[
                    "Open EC2 > Security Groups > Inbound rules.",
                    "Remove/replace 0.0.0.0/0 on sensitive ports.",
                    "Use private CIDRs, bastion SG references, or SSM Session Manager.",
                    "Document approved exceptions with compensating controls.",
                ],
                iac_path="infra/*.yaml (security groups) or network stack IaC",
                eta="15-60 minutes",
            ),
        )

    def _check_iam_password_policy(self) -> None:
        iam = self.session.client("iam")
        ok, policy, error = self._safe_call(iam.get_account_password_policy)
        pw = policy.get("PasswordPolicy", {}) if ok else {}
        min_len = int(pw.get("MinimumPasswordLength", 0))
        strong = (
            min_len >= 12
            and bool(pw.get("RequireSymbols"))
            and bool(pw.get("RequireNumbers"))
            and bool(pw.get("RequireUppercaseCharacters"))
            and bool(pw.get("RequireLowercaseCharacters"))
            and int(pw.get("MaxPasswordAge", 0)) <= 90
        )
        passed = strong or self.environment == ENV_DEV
        self._record(
            check_id="iam_password_policy",
            title="IAM password policy meets CJIS baseline",
            service="iam",
            passed=passed,
            details=f"Minimum length={min_len}, policyStrong={strong}",
            evidence={"passwordPolicy": pw, "error": error},
            remediation=Remediation(
                summary="Set CJIS-aligned IAM account password policy.",
                console_steps=[
                    "Open IAM > Account settings > Password policy.",
                    "Set min length >= 12 with symbol/number/upper/lower requirements.",
                    "Set max age <= 90 days and prevent password reuse.",
                    "Save and re-run validation.",
                ],
                iac_path="Account-level control (outside repo IaC); document in security baseline runbook",
                eta="10-20 minutes",
            ),
        )

    def _build_report(self) -> Dict[str, Any]:
        finished_at = dt.datetime.now(dt.timezone.utc)
        passed = sum(1 for r in self.results if r.passed)
        failed = len(self.results) - passed
        enforce_block = self.environment in STRICT_ENVS
        report = {
            "meta": {
                "tool": "cjis_compliance_checker.py",
                "timestamp_utc": finished_at.isoformat(),
                "duration_seconds": round((finished_at - self.started_at).total_seconds(), 2),
                "environment": self.environment,
                "region": self.region,
                "stage_hint": self.stage_hint,
                "strict_blocking": enforce_block,
            },
            "summary": {
                "total_checks": len(self.results),
                "passed": passed,
                "failed": failed,
                "status": "pass" if failed == 0 else "fail",
            },
            "checks": [
                {
                    **asdict(result),
                    "remediation": asdict(result.remediation),
                }
                for result in self.results
            ],
        }
        return report


def write_json_report(report: Dict[str, Any], output_file: Path) -> None:
    output_file.parent.mkdir(parents=True, exist_ok=True)
    with output_file.open("w", encoding="utf-8") as fp:
        json.dump(report, fp, indent=2)


def write_history(report: Dict[str, Any], history_file: Path) -> None:
    history_file.parent.mkdir(parents=True, exist_ok=True)
    with history_file.open("a", encoding="utf-8") as fp:
        fp.write(json.dumps(report, default=str) + "\n")


def write_html_report(report: Dict[str, Any], output_file: Path) -> None:
    output_file.parent.mkdir(parents=True, exist_ok=True)
    checks_html = []
    for check in report["checks"]:
        status = "PASS" if check["passed"] else "FAIL"
        color = "#16a34a" if check["passed"] else "#dc2626"
        remediation = check["remediation"]
        steps = "".join(f"<li>{step}</li>" for step in remediation["console_steps"])
        checks_html.append(
            f"""
            <section style="border:1px solid #e5e7eb;border-radius:8px;padding:12px;margin-bottom:12px;">
              <h3 style="margin:0 0 8px 0;">{check['title']}</h3>
              <p><strong>Status:</strong> <span style="color:{color};">{status}</span> ({check['severity']})</p>
              <p><strong>Details:</strong> {check['details']}</p>
              <p><strong>Evidence:</strong> {check['evidence_file']}</p>
              <p><strong>Fix ETA:</strong> {remediation['eta']}</p>
              <p><strong>IaC update path:</strong> {remediation['iac_path']}</p>
              <details>
                <summary><strong>Console remediation steps</strong></summary>
                <ol>{steps}</ol>
              </details>
            </section>
            """
        )
    html = f"""<!doctype html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>CJIS AWS Validation Report</title>
</head>
<body style="font-family:Arial,sans-serif;padding:20px;max-width:980px;margin:0 auto;">
  <h1>CJIS AWS Validation Report</h1>
  <p><strong>Timestamp (UTC):</strong> {report['meta']['timestamp_utc']}</p>
  <p><strong>Environment:</strong> {report['meta']['environment']}</p>
  <p><strong>Region:</strong> {report['meta']['region']}</p>
  <p><strong>Summary:</strong> {report['summary']['passed']}/{report['summary']['total_checks']} passed</p>
  {''.join(checks_html)}
</body>
</html>
"""
    with output_file.open("w", encoding="utf-8") as fp:
        fp.write(html)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Validate AWS environment against CJIS baseline controls.")
    parser.add_argument("--environment", required=True, choices=sorted(ALLOWED_ENVS))
    parser.add_argument("--region", default=os.environ.get("AWS_REGION", "us-east-1"))
    parser.add_argument("--stage-hint", default=os.environ.get("STAGE", "dev"))
    parser.add_argument("--profile", default=None, help="Optional AWS profile name")
    parser.add_argument("--report-dir", default="artifacts/cjis-validation")
    parser.add_argument("--json-output", default="cjis-validation-report.json")
    parser.add_argument("--html-output", default="cjis-validation-report.html")
    parser.add_argument("--history-file", default="history/cjis-validation-history.jsonl")
    parser.add_argument(
        "--fail-on-error",
        action="store_true",
        help="Return non-zero exit code when checks fail for staging/pilot/production.",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    report_dir = Path(args.report_dir)
    checker = ValidationChecker(
        environment=args.environment,
        region=args.region,
        stage_hint=args.stage_hint,
        report_dir=report_dir,
        profile=args.profile,
    )
    report = checker.run()

    json_path = report_dir / args.json_output
    html_path = report_dir / args.html_output
    history_path = report_dir / args.history_file
    write_json_report(report, json_path)
    write_html_report(report, html_path)
    write_history(report, history_path)

    print(f"CJIS validation report (JSON): {json_path}")
    print(f"CJIS validation report (HTML): {html_path}")
    print(f"Evidence directory: {report_dir / 'evidence'}")
    print(f"Validation status: {report['summary']['status']}")

    failed = int(report["summary"]["failed"])
    should_block = args.fail_on_error and args.environment in {ENV_STAGING, ENV_PILOT, ENV_PROD}
    if should_block and failed > 0:
        return 2
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
