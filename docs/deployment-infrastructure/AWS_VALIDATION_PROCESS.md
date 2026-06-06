# AWS Environment Validation Process (CJIS Controls)

This process validates critical AWS controls after deployment and before environment promotion.

## What This Validation Covers

`cjis_compliance_checker.py` verifies:

- WAF web ACL association for API Gateway stages
- CORS origin policy (wildcard blocked outside development)
- KMS key presence, key policy posture, and rotation
- CloudTrail active logging
- S3 bucket encryption
- DynamoDB table encryption at rest
- VPC flow logs
- Security group ingress exposure on sensitive ports
- IAM account password policy baseline

The script exports:

- JSON report (`cjis-validation-report.json`)
- HTML report (`cjis-validation-report.html`)
- Raw AWS evidence JSON files (per check)
- Append-only history (`history/cjis-validation-history.jsonl`)

## Environment Policy Levels

- `development`: relaxed validation, non-blocking behavior for known setup gaps
- `staging`: moderate validation; warnings still treated as deployment signal
- `pilot`: strict CJIS validation (blocking on failures)
- `production`: strict CJIS validation (blocking on failures)

## Required AWS Permissions

Validation principal needs read/list permissions for:

- `apigateway:GET`
- `wafv2:GetWebACLForResource`
- `kms:ListKeys`, `kms:DescribeKey`, `kms:GetKeyPolicy`, `kms:GetKeyRotationStatus`
- `cloudtrail:DescribeTrails`, `cloudtrail:GetTrailStatus`
- `s3:ListAllMyBuckets`, `s3:GetEncryptionConfiguration`
- `dynamodb:ListTables`, `dynamodb:DescribeTable`
- `ec2:DescribeVpcs`, `ec2:DescribeFlowLogs`, `ec2:DescribeSecurityGroups`
- `iam:GetAccountPasswordPolicy`

## How To Run Before Deployment Promotion

From repo root:

```bash
bash scripts/validate-aws-environment.sh development
bash scripts/validate-aws-environment.sh staging
bash scripts/validate-aws-environment.sh pilot
bash scripts/validate-aws-environment.sh production
```

Optional:

- `AWS_PROFILE=<profile>` to choose credentials
- `AWS_REGION=<region>` to override default region
- `REPORT_DIR=<path>` to override artifact location

## How To Interpret Results

- **PASS**: control validated for current environment policy level
- **FAIL**: control missing/misconfigured at current policy level
- Each failed check includes:
  - Console remediation steps
  - IaC file/path where the fix should be encoded
  - Estimated implementation time
  - Raw evidence file path

## What To Do With Failures

1. Open the HTML report and review failed checks.
2. Apply remediation in AWS console only as emergency mitigation when needed.
3. Backport permanent fixes into IaC (`infra/template.yaml` and related stacks).
4. Re-run validation and confirm all strict checks pass.
5. Attach JSON/HTML/evidence artifacts to deployment records and compliance evidence.

## CI/CD Integration Expectations

- Run validation **after each deployment**.
- Upload JSON/HTML/evidence as deployment artifacts.
- Block progression to strict environments (`pilot`, `production`) when validation fails.
- Preserve history artifacts for audit traceability.
