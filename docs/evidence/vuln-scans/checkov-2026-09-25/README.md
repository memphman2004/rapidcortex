# Checkov IaC scan — NexCort iQ `infra/`

- **Date:** 2026-09-25
- **Tool:** Checkov 3.3.19
- **Config:** `.checkov.yml` (documented accepts + archive skip-paths)
- **Command:** `checkov -d infra/ --config-file .checkov.yml --framework cloudformation`

## Baseline (before remediation)

| Scope | Passed | Failed |
|---|---:|---:|
| Full tree (incl. archives) | 3261 | 3814 |
| Live templates | 1934 | 1965 |

## After remediation

| Metric | Count |
|---|---:|
| Passed | 1362 |
| Failed | 0 |
| Skipped (policy) | see `.checkov.yml` |

Artifacts: `remediated/` (this run), `live/` (pre-skip baseline), `after-skip/` (skips only).

### What changed
- **Documented accepts** in `.checkov.yml` for Lambda VPC/DLQ/concurrency/env-CMK, DynamoDB CMK/PITR param evaluation, Secrets/Logs/ECR CMK, build-role IAM breadth, access-logging/WAF deferred stacks, intentional HTTP ALB / map identity pool, surge demo API.
- **Template hardening:** SQS/SNS `KmsMasterKeyId: alias/aws/sns|sqs`, ECR `ImageTagMutability: IMMUTABLE`, SG rule descriptions, ECS container insights, ALB TLS1.2+ SslPolicy + drop-invalid-headers, CloudFront TLS on downloads, S3 versioning on redirect/vision/translate/assets buckets.


Full narrative report: [CHECKOV_FULL_REPORT.md](./CHECKOV_FULL_REPORT.md)
