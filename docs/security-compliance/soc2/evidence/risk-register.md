# SOC 2 risk register

Product/pilot risks remain in [phase-0/risk-register.md](../../../phase-0/risk-register.md). This table is infrastructure and attestation risk.

| ID | Risk | Impact | Likelihood | Mitigation | Owner | Status |
|----|------|--------|------------|------------|-------|--------|
| R-SOC-001 | Shared AWS account hosts other products | High (scope dispute) | Med | Carve-out in [SYSTEM-BOUNDARY.md](../SYSTEM-BOUNDARY.md); Rapid Cortex naming; dedicated account later | Management | **Accepted** for first window |
| R-SOC-002 | Next SAM deploy creates Object Lock COMPLIANCE CloudTrail bucket if `EnableCloudTrail=true` | High (irreversible cost/lock) | Med | Override library **blocks** SAM trail create on `deploy.sh dev` | Eng | Mitigated in repo |
| R-SOC-003 | `DynamoPointInTimeRecovery=auto` on `DeploymentStage=dev` would disable AppSam PITR | High (Type II gap) | High without lock-in | Force `DDB_ENABLE_PITR=true`; `EnablePilotGradeBackups` includes `dev` | Eng | Mitigated in repo |
| R-SOC-004 | Secrets without automatic rotation | Med | High | Manual SOP + tickets | Eng | Compensating |
| R-SOC-005 | No customer-managed KMS keys | Low–Med | Certain | AWS-managed rotation; document ACCEPT | Security | Accepted |
| R-SOC-006 | Paging not proven (PLT-025) | Med | Med | Wire SNS to on-call; tabletop | Ops | Open |
| R-SOC-007 | Runbooks not exercised (PLT-026) | Med | Med | Tabletop + restore drill before 2026-10-01 | Ops | Open |
| R-SOC-008 | Overclaim Type II in sales | High | Med | Promise control; this pack disclaimer | Sales | Ongoing |
| R-SOC-009 | CAD write-back enabled on live by mistake | Critical | Low | `deploy.sh` rejects `CAD_WRITEBACK_ENABLED=true` on `dev` | Eng | Mitigated in repo |
| R-SOC-010 | G3 platform scan still YELLOW until live `npm run security:g3` | Med | Med | Run and attach evidence | Eng | Open |
| R-SOC-011 | Entity naming AOD vs Rapid Cortex LLC | Med | High | LEG-007 | Legal | Open |
| R-SOC-012 | No CPA firm engaged | Critical for report | High | SOC-101 | Management | Open |

**Last quarterly review:** _pending (pre-window)_
