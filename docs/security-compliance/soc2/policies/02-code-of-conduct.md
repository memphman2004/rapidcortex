# POL-02 Code of conduct and acceptable use

| Field | Value |
|-------|--------|
| Policy ID | POL-02 |
| TSC | CC1.1, CC1.5 |
| Owner | Jeff Coleman (interim security lead) |
| Approver | Management |
| Effective | DRAFT 2026-09-19 |
| Review | Annual |

**Not a Type II report.** Signed acknowledgements live in HR systems, not git.

## 1. Required conduct

Personnel with access to NexCort iQ production or customer data must:

- Use production access only for assigned duties.
- Never exfiltrate transcripts, CAD payloads, or caller media to personal devices, public AI chat tools, or unsanctioned SaaS.
- Never log JWT tokens, passwords, or full transcripts in tickets, Slack, or CloudWatch (beyond existing redaction).
- Never claim SOC 2 / CJIS / HIPAA **certification** in sales or support.
- Report suspected security incidents the same day to on-call.
- Complete security awareness at hire and annually ([POL-12](./12-hr-security-awareness.md)).

## 2. Acceptable use of production

| Allowed | Forbidden |
|---------|-----------|
| Break-glass with a ticket | Shared IAM users / shared Cognito passwords |
| Read-only auditor role for evidence | Using `rapid-cortex-deploy` as an auditor login |
| Staging (`DeploymentStage=staging`) for engineering | Treating `deploy.sh dev` as a sandbox |
| Mock/dev paths for AI vendors | Enabling CAD write-back without addendum |
| Copying **redacted** snippets into tickets | Pasting live incident text into consumer LLMs |

## 3. Conflicts of interest / fraud

Privileged users must not approve their own access grants. Deployments that change IAM, Cognito, WAF, or CloudTrail require a second reviewer ([POL-04](./04-change-management-policy.md)).

## 4. Acknowledgement

New and existing production-access personnel acknowledge this policy. Record in [hr-training-log.md](../evidence/hr-training-log.md) by **role and date only** (no SSNs, no home addresses).
