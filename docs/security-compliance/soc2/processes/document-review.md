# SOP — Document review (60-day)

**TSC:** CC1.2, CC2.1, CC6.1  
**Owner:** Jeff Coleman (interim security lead)  
**Cadence:** Every **60 days**, and always before an observation-window start.

**Not a Type II report.** This SOP keeps operating documents aligned with live production. It does not create an attestation.

## 1. In-scope families

| Family | Canonical markdown (git) | What “review” means |
|--------|--------------------------|---------------------|
| **MFA / auth** | [AUTH_OPERATIONS.md](../../../product-architecture/AUTH_OPERATIONS.md), [AUTH_AND_TENANCY.md](../../../phase-4/AUTH_AND_TENANCY.md), [PRODUCTION_SECURITY_CHECKLIST.md](../../PRODUCTION_SECURITY_CHECKLIST.md), [native-auth-flow.md](../../../native-auth-flow.md), [SECURITY_MODEL.md](../../SECURITY_MODEL.md), [POL-03](../policies/03-access-control-policy.md) | Confirm Cognito `MfaConfiguration=ON` on the production pool; TOTP/SMS challenge paths; privileged roles; no “MFA is backlog” language. Re-run `scripts/soc2-access-review.sh` if CLI evidence is also stale. |
| **Contracts** | [CONTRACT_PACKAGE_INDEX.md](../../../go-to-market-sales/CONTRACT_PACKAGE_INDEX.md), [legal-drafts/](../../../go-to-market-sales/legal-drafts/) | Confirm entity-naming gap, DPA/order-form still **DRAFT**, SOC 2 language is “aligned / observation” not “certified.” |
| **Pilot** | [PILOT_OVERVIEW.md](../../../go-to-market-sales/PILOT_OVERVIEW.md) and sibling `PILOT_*.md`, [training/](../../../training/), [READ_ONLY_CAD_PILOT_GATE.md](../../../customer-readiness/READ_ONLY_CAD_PILOT_GATE.md) | Assistive-use / human-in-the-loop; MFA required for floor users; CAD write-back default **off**; links resolve via [INDEX.md](../../../INDEX.md). |

## 2. Out of git / do not rewrite

| Artifact | Rule |
|----------|------|
| Executed equity offer letters, wet-ink NDAs, signed MSAs | **Records.** Do not edit. Store in the private compliance / legal share. |
| `COMPLETE_MSA_MASTER_DOCUMENT.docx`, Platform Agreement, NC Lite Agreement | Counsel + entity reconciliation ([DOCUMENT_GAPS.md](../../../go-to-market-sales/DOCUMENT_GAPS.md) LEG-007). Markdown index points at them; this SOP does not regenerate Word. |
| May 2026 Internal Product PDFs (pilot scope, CJIS/SOC2 alignment, data-flow, go/no-go) | Treat as **archive copies**. Canonical language lives in markdown. Counsel regenerates PDFs when LEG-001 closes. |
| Cognito / IAM JSON under `docs/evidence/` | Re-collect with scripts. Do not hand-edit snapshots. |

## 3. Procedure

1. List files in the three families with `mtime` (or last git change) **> 60 days**.
2. For each markdown file: set **Last reviewed** to the review date; fix facts and broken links; do not invent certifications.
3. If production MFA, PITR, or CloudTrail has changed, update POL-03 / SECURITY_MODEL / the questionnaire in the same change set and attach fresh CLI evidence.
4. Log the cycle in [document-review-log.md](../evidence/document-review-log.md).
5. Open tickets for items that need humans (counsel, Finance, wet signatures). Git cannot close those.

## 4. Pass criteria

- No in-scope markdown still claims MFA is optional or “CJIS backlog” for production.
- No in-scope markdown claims SOC 2 Type II / certified.
- Contract index date matches this review.
- Pilot kickoff / validation checklists require MFA enrollment for floor users.
- Ledger row completed for the cycle.
