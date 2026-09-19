# Monthly control check

Complete after `scripts/soc2-observation-pack.sh`. Mark PASS / FAIL / N/A. FAIL needs a ticket the same day.

| Month | Pack path | CloudTrail logging | PITR sample | Cognito MFA ON | WAF logging | ACM alarm | Secrets rotation tickets | Reviewer |
|-------|-----------|--------------------|-------------|----------------|-------------|-----------|--------------------------|----------|
| 2026-09 baseline | `docs/evidence/soc2-evidence/2026-10/` | PASS (`rapid-cortex-cloudtrail-prod`) | PASS 182/182 | PASS `us-east-1_0z6tA6WBs` | PASS CF ACLs | PASS `rc-acm-cert-expiry-cc0f7fc4` | SOP only | Track 1 |
| 2026-09-19 re-attest | hashes of 2026-10 pack; **no new AWS CLI** | PASS (stale-dated) | PASS 182/182 TSV | PASS (stale-dated) | PASS (stale-dated) | ACCEPT — alarm `INSUFFICIENT_DATA` at create | SOP only | Jeff Coleman |
| 2026-10 | | | | | | | | |
| 2026-11 | | | | | | | | |
| 2026-12 | | | | | | | | |
| 2027-01 | | | | | | | | |
| 2027-02 | | | | | | | | |
| 2027-03 | | | | | | | | |
