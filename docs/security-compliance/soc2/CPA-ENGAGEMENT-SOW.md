# CPA / SOC 2 Type II engagement SOW (draft)

**Status:** DRAFT for management to send. **Do not email a firm from this repository.**  
**Not a Type II report.**

## 1. Company

- Legal name: Apps on Demand LLC d/b/a Rapid Cortex (confirm vs LEG-007 before sending)
- System: Rapid Cortex cloud SaaS (assistive emergency-communications intelligence; does **not** replace CAD/911)
- Production: `https://app.rapidcortex.us`, stack `rapid-cortex-dev`, AWS account `158961537080`, region `us-east-1`
- Contact: Jeff Coleman · `privacy@rapidcortex.us`

## 2. Requested service

SOC 2 **Type II** examination under AICPA TSC **2017, Security category only** (CC1–CC9). Confidentiality / availability / processing integrity / privacy categories are **out of scope** unless we expand in a change order.

**Target period start:** 2026-10-01  
**Period length:** 6 months (through 2027-03-31) preferred; 12 months optional  
**Report use:** customer trust / procurement (not a marketing “certification” seal)

## 3. System description (attach)

- [SYSTEM-BOUNDARY.md](./SYSTEM-BOUNDARY.md)
- [CONTROL-MATRIX.md](./CONTROL-MATRIX.md)
- Technical baseline: `docs/evidence/soc2-evidence/2026-10/`
- Policies POL-01–12 and SOPs under `docs/security-compliance/soc2/`

## 4. What Rapid Cortex will provide (PBC)

- Read-only IAM role `rapid-cortex-soc2-auditor` (SecurityAudit + ReadOnlyAccess)
- Monthly observation packs (`scripts/soc2-observation-pack.sh`)
- Quarterly access and vendor reviews
- Change log of production deploys
- IR tabletop and restore-drill packets
- AWS Artifact reports for inherited physical security (CC6.8)
- Signed policies (this packet)

## 5. Known scoping issues to disclose in the first call

1. **Shared AWS account** with other products (carve-out proposed; dedicated account is a post-window improvement).
2. Production CloudFormation stage name is `dev` (live `app.rapidcortex.us`) — do not treat as a sandbox.
3. CloudTrail is Option B: trail `rapid-cortex-cloudtrail-prod`, not the SAM resource `rapid-cortex-audit-dev`.
4. Secrets Manager has **no automatic rotation**; compensating SOP + tickets.
5. No customer-managed KMS CMKs (AWS-managed keys only).
6. Small-company concentration: one named owner for security/eng/management until staffed.
7. CAD write-back is out of scope / fail-closed.
8. We do **not** claim CJIS, HIPAA, or FedRAMP certification.

## 6. What we are asking the firm to quote

- Type II Security, 6-month and 12-month options
- Readiness / gap letter if they will not start 2026-10-01 on current evidence
- Whether they will accept the shared-account carve-out
- Timeline from kickoff to report
- Fee range and whether bridge letters are included

## 7. Firms to consider (examples, not an endorsement)

AICPA-peer-reviewed SOC firms that routinely do SaaS on AWS (e.g. A-LIGN, Schellman, BARR, Johanson). Management picks; engineering does not send the email.

## 8. Out of scope for this SOW

Pen-test (separate LEG-010), DPA execution, Charleston C2C RFP 6212-27L, CAD write-back enablement, renaming stack `rapid-cortex-dev`.
