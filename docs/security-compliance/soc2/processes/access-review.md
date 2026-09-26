# SOP — Quarterly access review

**TSC:** CC6.1–CC6.3  
**Owner:** Security lead  
**Cadence:** Quarterly and at hire/termination of privileged staff

## Steps

1. Open a ticket `soc2-access-review-YYYY-QN`.
2. Run (read-only):

   ```bash
   AWS_PROFILE=rapid-cortex AWS_DEFAULT_REGION=us-east-1 \
     bash scripts/soc2-access-review.sh
   ```

3. Review IAM users (MFA, access keys age), IAM groups, the `rapid-cortex-soc2-auditor` and deploy roles, and Cognito users in pool `us-east-1_0z6tA6WBs` with privileged groups (`rcsuperadmin`, `rcadmin`, `rcitadmin`, and AWS console humans).
4. For each privileged principal: confirm still employed/contracted, role still required, MFA present.
5. Disable or down-scope exceptions the same week. Ticket the follow-up.
6. Two people sign the [access-review-log.md](../evidence/access-review-log.md) row (reviewer + approver). Store any export containing emails in the private compliance share, not git, if the CSV is PII-heavy.

Do not paste access-key secret values or Cognito temporary passwords into the log.
