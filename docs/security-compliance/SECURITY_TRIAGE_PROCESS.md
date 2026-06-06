# Security Triage Process

## Purpose
This process defines how Rapid Cortex handles findings from CI security gates:
- CodeQL (SAST + code scanning)
- npm audit (dependency vulnerabilities)
- Semgrep (custom appsec patterns)
- Checkov (IaC scan)
- Trivy (deployment image/library scan)

## Severity And SLA
- Critical: acknowledge immediately, remediation start within 4 hours, fix within 24 hours.
- High: acknowledge within 4 hours, remediation start within 1 business day, fix within 48 hours.
- Moderate: triage within 1 business day, fix in current sprint unless risk accepted.
- Low: backlog with owner and review at least monthly.

## Triage Workflow
1. Confirm signal quality and reproduction details from CI logs/artifacts.
2. Classify severity and business impact (availability, confidentiality, integrity, compliance).
3. Assign owner (service team + security contact).
4. Decide mitigation path:
   - Immediate code/dependency fix, or
   - Temporary containment (feature flag, denylist, WAF/rule), or
   - Explicit risk acceptance with expiry.
5. Open tracked remediation item with due date and rollback/testing plan.
6. Validate fix via rerun of security workflow and attach evidence.
7. Close finding only after all required checks pass in CI.

## Escalation Path
- Primary: owning engineering team.
- Secondary: security team reviewer.
- P0 blockers (critical/high in merge path): escalate to on-call engineering lead and security lead.
- Release-impacting unresolved blockers: escalate to CTO/VP Eng decision.

## Policy Gates In CI
- Merge blocked when:
  - npm audit has moderate/high/critical vulnerabilities.
  - Security tests fail (`npm run test:security`).
  - License policy check fails (GPL/AGPL and non-approved licenses blocked).
  - Checkov or Trivy reports blocking issues in deployment pipeline.
  - CodeQL detects open high/critical alerts on the PR merge ref.

## Branch protection recommendations
On your **version-control / CI platform** (wherever `main` or release branches live):

- Require status checks that map to your gates (typecheck, build, tests, security suite, IaC scan).
- Require pull request review before merge.
- Require extra review for infra changes (`infra/**`, IAM, SAM templates), including security team where applicable.
- Dismiss stale approvals on new commits.
- Require branches to be up to date before merge.

## Security dashboard
- **SAST:** use your platform’s code scanning UI (for example CodeQL, Semgrep, or vendor SARIF ingestion).
- **Dependency audit:** retain `npm-audit-report.json` (or equivalent) as a build artifact per release.
- **IaC:** Checkov SARIF or equivalent under a stable category name (e.g. `checkov-iac`).
- Track MTTR by severity in weekly security review (openedAt, acknowledgedAt, fixedAt, deployedAt).

## Evidence And Auditability
- Keep all security scan artifacts for at least 90 days.
- Link each critical/high finding to:
  - owning PR
  - incident/change record
  - validation run URL
- For CJIS-related issues, attach remediation evidence to compliance records.
