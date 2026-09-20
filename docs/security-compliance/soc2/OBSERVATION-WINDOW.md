# Observation window — Rapid Cortex SOC 2 Type II (target)

**Not a Type II report.** This is the operating calendar management intends to hand a CPA firm.

| Field | Value |
|-------|--------|
| Target period start | **2026-10-01** (UTC) |
| Recommended period end | **2027-03-31** (6 months) or **2027-09-30** (12 months) — CPA firm confirms |
| Category | Security (TSC CC1–CC9) |
| Production system | `rapid-cortex-dev` / `app.rapidcortex.us` / account `158961537080` |
| Pre-window baseline | 2026-09-17 technical snapshots + 2026-10 named CLI artifacts |

A control that is **not operating on day 1** is a finding for the **entire** period. Do not start the clock if PITR, CloudTrail logging, Cognito MFA ON, or WAF logging have regressed. Re-run:

```bash
AWS_PROFILE=rapid-cortex AWS_DEFAULT_REGION=us-east-1 \
  bash scripts/soc2-technical-controls-snapshot.sh
AWS_PROFILE=rapid-cortex AWS_DEFAULT_REGION=us-east-1 \
  bash scripts/soc2-observation-pack.sh
```

---

## Pre-window closeout (complete by 2026-09-30)

| # | Activity | Owner | Done when |
|---|---------|-------|-----------|
| 1 | Management signs policies 01–12 (PDF off-git) | Jeff Coleman | [SIGNATURE-PACKET.md](./SIGNATURE-PACKET.md) ready; **wet sign outstanding** |
| 2 | Fill [OPS_CONTACT_MATRIX](../../operations-runbooks/OPS_CONTACT_MATRIX.md) | Jeff Coleman | **DONE** 2026-09-19 (agency rows still per-pilot) |
| 3 | First access review (IAM + Cognito privileged) | Jeff Coleman | **CONDITIONAL** — [03-access-review.md](./evidence/2026-09-19-prewindow/03-access-review.md) |
| 4 | Vendor/subprocessor review | Jeff Coleman | **DONE** v0.3 |
| 5 | IR tabletop (SEV-1 credential leak **or** tenant isolation scare) | Jeff Coleman | **DONE** scenario 1 |
| 6 | Restore drill: PITR **to a new table**, validate counts, **do not cut over** | Eng | **DRY_RUN**; live restore needs AWS |
| 7 | Confirm live deploy lock-in: next `deploy.sh dev` uses PITR=true and does **not** create SAM CloudTrail | Eng | In repo (`soc2-live-production-overrides.sh`); next live deploy still to happen |
| 8 | Engage CPA firm (SOW) | Management | [CPA-ENGAGEMENT-SOW.md](./CPA-ENGAGEMENT-SOW.md) draft; **not sent** |
| 9 | Store signed carve-out of shared account | Management | Same signature packet |

---

## During the window

| Cadence | Activity | Script / log |
|---------|----------|--------------|
| Monthly (first business day) | Technical observation pack | `scripts/soc2-observation-pack.sh` → `docs/evidence/soc2-evidence/YYYY-MM/` |
| Monthly | Control checklist | [monthly-control-check](./evidence/monthly-control-check.md) |
| Monthly | Change log sweep (prod deploys + infra PRs) | [change-log](./evidence/change-log.md) |
| Quarterly | Access review | `scripts/soc2-access-review.sh` + [access-review-log](./evidence/access-review-log.md) |
| Quarterly | Vendor review | [vendor-review-log](./evidence/vendor-review-log.md) |
| Quarterly | Risk register | [risk-register](./evidence/risk-register.md) |
| Every 60 days | MFA / contract / pilot document review | [document-review SOP](./processes/document-review.md) + [document-review-log](./evidence/document-review-log.md) |
| On event | Security/ops incidents | IR tickets; no PII in git |
| On event | Secret rotation | [secrets-rotation-sop](../../evidence/soc2-evidence/2026-10/secrets-rotation-sop.md) |
| Annually (or before window) | Tabletop + restore drill | process docs |

---

## Calendar (first six months)

| Month | Technical pack | Access review | Vendor | Tabletop / restore | Notes |
|-------|----------------|---------------|--------|--------------------|-------|
| 2026-09 (pre) | Baseline exists | First review | First review | Run both before 10/01 | Sign policies; 60-day MFA/contract/pilot doc review |
| 2026-10 | Monthly pack | — | — | — | Period start |
| 2026-11 | Monthly pack | — | — | — | |
| 2026-12 | Monthly pack | Q2 review | Q2 review | — | |
| 2027-01 | Monthly pack | — | — | — | |
| 2027-02 | Monthly pack | — | — | — | |
| 2027-03 | Monthly pack | Q3 review | Q3 review | Optional mid-period tabletop | Candidate period end |

Copy this table into the CPA PBC (prepared-by-client) list when the firm is engaged.

---

## Evidence retention

- Keep original AWS CLI JSON (not just summaries). Auditors sample `raw/`.
- Observation packs stay in git **without secret values**. `soc2-observation-pack.sh` uses `describe-secret` metadata only.
- Signed HR/board PDFs stay in the private compliance share, not this repository.
- Application logs must not contain raw transcripts, passwords, or refresh tokens ([PRIVACY_RETENTION_DECISIONS.md](../PRIVACY_RETENTION_DECISIONS.md)).
