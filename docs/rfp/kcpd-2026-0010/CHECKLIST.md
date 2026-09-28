# KCPD RFP 2026-0010 — submission checklist

**Event:** AI-Assisted Non-Emergency Call Management Solution  
**Addendum:** 4  
**Response deadline:** 2026-09-30 15:30 CT  
**Portal only** — no email/fax. Purchasing: Sharene.Marquez@kcpd.org (process only; no sales contact with KCPD staff).

Canonical product map: `packages/shared/src/call-assist/bid-matrix.ts`  
Demo script: [KCPD_CALL_ASSIST_DEMO_PLAYBOOK.md](../../go-to-market-sales/KCPD_CALL_ASSIST_DEMO_PLAYBOOK.md)

---

## Done in-repo (attach / paste)

| Item | Artifact | Status |
|------|----------|--------|
| Scope of Services | [01-scope-of-services.md](./01-scope-of-services.md) | Ready to convert to PDF and upload |
| Line-item supplier notes | [02-line-item-supplier-notes.md](./02-line-item-supplier-notes.md) | Paste into portal Supplier Notes / attach sheet |
| Pricing outline structure | [03-pricing-outline-template.md](./03-pricing-outline-template.md) | **Dollar amounts still blank — fill before submit** |
| References worksheet | [04-references-worksheet.md](./04-references-worksheet.md) | **Names/contacts still blank — fill before submit** |
| CJIS / cybersecurity cover | [05-cybersecurity-and-cjis-cover.md](./05-cybersecurity-and-cjis-cover.md) + [../cybersecurity-controls.md](../cybersecurity-controls.md) | Ready; attach pack zip |
| Implementation / training / maintenance | [06-implementation-kcpd-overlay.md](./06-implementation-kcpd-overlay.md) + [../implementation-and-transition.md](../implementation-and-transition.md) | Ready; fill owners/dates in SOW |
| Forbidden-language gate | [../README.md](../README.md) | Follow when editing narrative |
| Demo dry-run procedure | Playbook + scenario library `kcpd-rfp-2026` | Procedure ready; **human must rehearse** |
| Bid matrix honesty redline | `bid-matrix.ts` (2026-09-27) | Done |
| Architecture diagrams | [07-architecture-overview.md](./07-architecture-overview.md) + `diagrams/*.png` | Ready to attach |

---

## Human / portal only (cannot complete from git)

| Item | Owner | Notes |
|------|-------|-------|
| Online bid account + submit | Sales / ops | Actions tab → Documents |
| W9 | Finance | Attachment tab |
| Federal Debarment Form (signed) | Finance / legal | Attachment tab |
| Vendor Application Information Update Form | Ops | Fillable version posted in addendum |
| Cooperative Procurement Form | Ops | As applicable |
| Federal Award Verification Form | Ops | As applicable |
| Reference Information Sheet (portal PDF) | Sales | Use [04-references-worksheet.md](./04-references-worksheet.md) as working draft |
| Line Item tab prices ($ for each of 26 lines) | Sales / finance | Use [03-pricing-outline-template.md](./03-pricing-outline-template.md) |
| Conflict of Interest attribute | Legal / Jeff | Portal Bid Attributes |
| Communications Statement / Proposal Opening checkboxes | Submitter | Portal Bid Attributes |
| Live demo rehearsal (scripted) | SE + Jeff | Playbook § timing; do **not** patch live DID into Zoom |
| 3 LE / PSAP references (≥1 agency &gt;500k if possible) | Sales | **Do not invent** |
| Executed CJIS Security Addendum (post-award) | Legal | Not a Day-0 portal form; prepare draft |
| Current third-party pen-test PDF (if required by ITSU) | Security | Separate SOW; Checkov evidence is not a pen test |

---

## Suggested upload bundle

1. `01-scope-of-services.pdf` (export from markdown)  
2. `02-line-item-supplier-notes.pdf` (or paste notes per line)  
3. `03-pricing-outline.pdf` (filled $)  
4. Completed portal Reference Information Sheet  
5. RFP security zip per [../README.md](../README.md) + this folder’s `05-cybersecurity-and-cjis-cover.md`  
6. `06-implementation-kcpd-overlay.pdf`  
7. Required portal forms (W9, debarment, vendor app, …)

---

## Version

| Date | Notes |
|------|-------|
| 2026-09-27 | Initial checklist + artifacts for Addendum 4 |
