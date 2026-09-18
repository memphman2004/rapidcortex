#!/usr/bin/env python3
"""Unit tests for SOC 2 technical-control verdicts."""

import json
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from soc2_controls_verdict import (  # noqa: E402
    ACCEPT,
    GAP,
    PASS,
    UNKNOWN,
    all_pass_or_accept,
    evaluate_controls,
)


def _base_summary(**overrides):
    summary = {
        "collectedAtUtc": "2026-09-18T00:00:00Z",
        "account": "158961537080",
        "principal": "arn:aws:iam::158961537080:user/rapid-cortex-deploy",
        "region": "us-east-1",
        "stack": "rapid-cortex-dev",
        "controls": {
            "cloudtrail": {
                "listDenied": False,
                "lookupEventsWorks": True,
                "enableCloudTrailParam": "false",
                "logBucketExists": True,
            },
            "s3": {
                "rapidCortexBucketCount": 19,
                "rapidCortexMissingEncryption": [],
                "rapidCortexMissingBpa": [],
                "rapidCortexAlgorithms": ["AES256"],
                "accountMissingEncryption": ["mel-landing-page"],
            },
            "dynamodbPitr": {
                "rapidCortexTableCount": 182,
                "pitrEnabled": 182,
                "pitrDisabled": [],
                "parameter": "auto",
            },
            "kms": {"listDenied": False, "cfnCustomerKeys": []},
            "secrets": {"listDenied": False, "described": 36},
            "waf": {
                "regionalCount": 0,
                "cloudfrontCount": 3,
                "loggingGaps": [
                    {
                        "name": "CreatedByCloudFront-a0a27a88",
                        "error": "WAFNonexistentItemException",
                    }
                ],
                "enableApiWafParam": "false",
            },
            "cloudwatchAlarms": {
                "ok": 16,
                "alarm": 0,
                "insufficientData": 2,
                "total": 18,
                "okNames": [
                    "rc-acm-cert-expiry-cc0f7fc4",
                    "rapid-cortex-acm-expiry-api-rapidcortex-us",
                ],
                "alarmNames": [],
            },
            "cognitoMfa": {
                "productionUserPoolId": "us-east-1_0z6tA6WBs",
                "mfaConfiguration": "ON",
                "passwordMinLength": 12,
            },
            "acm": {"listDenied": False, "issuedCount": 17},
        },
    }
    for k, v in overrides.items():
        if k in summary["controls"] and isinstance(v, dict):
            summary["controls"][k].update(v)
        else:
            summary[k] = v
    return summary


class VerdictTests(unittest.TestCase):
    def _statuses(self, summary, **kwargs):
        rows = evaluate_controls(summary, **kwargs)
        return {r["control"]: r["status"] for r in rows}, rows

    def test_post_fix_snapshot_is_all_pass_or_accept(self):
        with tempfile.TemporaryDirectory() as tmp:
            sop = Path(tmp) / "secrets-rotation-sop.md"
            sop.write_text("# SOP\n", encoding="utf-8")
            raw = Path(tmp) / "raw"
            raw.mkdir()
            (raw / "stamp-01-cloudtrail-list-trails.json").write_text(
                json.dumps(
                    {
                        "Trails": [
                            {
                                "Name": "rapid-cortex-cloudtrail-prod",
                                "TrailARN": "arn:aws:cloudtrail:us-east-1:158961537080:trail/rapid-cortex-cloudtrail-prod",
                            }
                        ]
                    }
                ),
                encoding="utf-8",
            )
            (raw / "stamp-01-cloudtrail-describe-trails.json").write_text(
                json.dumps(
                    {
                        "trailList": [
                            {
                                "Name": "rapid-cortex-cloudtrail-prod",
                                "LogFileValidationEnabled": True,
                                "IsMultiRegionTrail": True,
                            }
                        ]
                    }
                ),
                encoding="utf-8",
            )
            (raw / "stamp-01-cloudtrail-status-rapid-cortex-cloudtrail-prod.json").write_text(
                json.dumps({"IsLogging": True}),
                encoding="utf-8",
            )
            statuses, rows = self._statuses(
                _base_summary(),
                raw=raw,
                stamp="stamp",
                sop_path=sop,
                kms_rows=[
                    {
                        "metadata": {"KeyManager": "AWS", "KeyState": "Enabled"},
                        "rotation": {"KeyRotationEnabled": True},
                    }
                ],
            )
        self.assertTrue(all_pass_or_accept(rows), rows)
        self.assertEqual(statuses["CloudTrail + log-file validation"], PASS)
        self.assertEqual(statuses["S3 encryption + Block Public Access"], PASS)
        self.assertEqual(statuses["DynamoDB PITR"], PASS)
        self.assertEqual(statuses["KMS CMK rotation"], ACCEPT)
        self.assertEqual(statuses["Secrets Manager rotation"], ACCEPT)
        self.assertEqual(statuses["WAF logging"], PASS)
        self.assertEqual(statuses["CloudWatch / ACM expiry"], PASS)
        self.assertEqual(statuses["Cognito MFA"], PASS)
        self.assertEqual(statuses["ACM expiry monitoring"], PASS)

    def test_optional_mfa_is_gap(self):
        statuses, _ = self._statuses(_base_summary(cognitoMfa={"mfaConfiguration": "OPTIONAL"}))
        self.assertEqual(statuses["Cognito MFA"], GAP)

    def test_pitr_disabled_is_gap(self):
        statuses, _ = self._statuses(
            _base_summary(dynamodbPitr={"pitrDisabled": ["rapid-cortex-agencies-dev"], "pitrEnabled": 181})
        )
        self.assertEqual(statuses["DynamoDB PITR"], GAP)

    def test_kms_denied_without_rows_is_unknown(self):
        statuses, _ = self._statuses(_base_summary(kms={"listDenied": True}), kms_rows=[])
        self.assertEqual(statuses["KMS CMK rotation"], UNKNOWN)

    def test_secrets_without_sop_is_gap(self):
        statuses, _ = self._statuses(_base_summary(), sop_path=None)
        self.assertEqual(statuses["Secrets Manager rotation"], GAP)

    def test_in_scope_waf_logging_gap_is_gap(self):
        statuses, _ = self._statuses(
            _base_summary(
                waf={
                    "loggingGaps": [{"name": "rapid-cortex-httpapi-cdn-waf-dev"}],
                    "cloudfrontCount": 3,
                }
            )
        )
        self.assertEqual(statuses["WAF logging"], GAP)

    def test_missing_acm_alarm_is_gap(self):
        statuses, _ = self._statuses(
            _base_summary(cloudwatchAlarms={"okNames": ["some-other-alarm"], "total": 1, "ok": 1, "alarm": 0, "insufficientData": 0})
        )
        self.assertEqual(statuses["ACM expiry monitoring"], GAP)
        self.assertEqual(statuses["CloudWatch / ACM expiry"], GAP)

    def test_cloudtrail_denied_without_trail_is_unknown(self):
        summary = _base_summary(cloudtrail={"listDenied": True, "lookupEventsWorks": False, "logBucketExists": False})
        statuses, _ = self._statuses(summary)
        self.assertEqual(statuses["CloudTrail + log-file validation"], UNKNOWN)


if __name__ == "__main__":
    unittest.main()
