# SOP — Evidence collection

**TSC:** CC4.1, CC7.1  
**Cadence:** Monthly during the observation window

## Monthly pack

```bash
AWS_PROFILE=rapid-cortex AWS_DEFAULT_REGION=us-east-1 \
  bash scripts/soc2-observation-pack.sh
```

Writes under `docs/evidence/soc2-evidence/YYYY-MM/` (override with `SOC2_EVIDENCE_DIR`). Includes caller identity, CloudTrail status for `rapid-cortex-cloudtrail-prod`, Cognito MFA, PITR sample, WAF logging, ACM alarm, secret **metadata**, CloudWatch alarm summary.

Then tick [monthly-control-check.md](../evidence/monthly-control-check.md).

## Rules

- Read-only. This SOP does not enable CloudTrail, WAF, or PITR (that is change control / Track 1 scripts).
- No `get-secret-value`. No JWT. No transcript scans.
- Keep `raw/` JSON. Do not replace it with a rewritten summary.
- If AWS CLI is missing or AccessDenied, file a ticket; do not invent PASS.

Full baseline remains `scripts/soc2-technical-controls-snapshot.sh`.
