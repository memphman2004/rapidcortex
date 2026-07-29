# Billing / first real invoice — Item 10 status

**Date:** 2026-07-28  
**Goal:** Ready to invoice when pilot converts (Privacy/ToS already done).

## SES domain verify (TODO-4)

| Check | Result |
|-------|--------|
| `rapidcortex.us` SES identity | **Success** (verified) |
| DKIM | **SUCCESS** |
| `support@rapidcortex.us` | **Success** |
| `billing@rapidcortex.us` separate identity | Not required — domain identity covers `*@rapidcortex.us` |
| SES production access | **NOT enabled** (`ProductionAccessEnabled: false`) — account still in SES sandbox |

**Human action required:** Request SES production access in AWS Console (SES → Account dashboard → Request production access) so invoices can be emailed to external agency domains. Until then, SES only delivers to verified identities.

## Invoice sequencing (TODO-2 / H6)

Implemented atomic counter on invoices table key `INVOICE_SEQUENCE` via `UpdateItem` increment.

- Module: `apps/api/src/lib/billing/invoice-sequence.ts`
- Format: `RC-YYYY-NNNNN` (MSA §4.4)
- Seeds from historical max on first create
- Wired into invoice create, bulk draft, and schedule processor

## Cents migration (TODO-3 / H7)

Write path now dual-writes integer cents + dollar mirrors:

- `subtotalCents` / `discountCents` / `taxCents` / `totalCents`
- Line items: `unitPriceCents` / `lineTotalCents`
- API/UI still accepts dollars; conversion at write boundary (`money-cents.ts`)
- PDF + email resolve prefer `*Cents`

## 15-day advance schedule (TODO-6 / M3)

- EventBridge: `cron(0 9 15 * ? *)` → `BillingSchedulerFunction` with `{"mode":"advance_monthly"}`
- Generates next-month period invoices with due date = last day of next month
- Daily scheduler unchanged (`cron(0 8 * * ? *)`, mode `daily`)

## Banking secrets → PDF/email (TODO-1 / TODO-5)

| Item | Status |
|------|--------|
| Secret `rapid-cortex/billing/payment-instructions` | Exists in account |
| Lambda env `BILLING_PAYMENT_INSTRUCTIONS_SECRET_ARN` | **Wired** in SAM4 (was missing) |
| IAM `GetSecretValue` on payment secret | **Added** `AppManagedPolicySecretsBillingPaymentInstructionsRead` |
| Load secret on non-prod stages | **Fixed** (was production-only) |
| Accept camelCase + UPPER_SNAKE keys | **Fixed** |
| Validate before email send | **Enforced** (blocks blank/placeholder ACH/check) |

**Human action:** Confirm secret values are real (not `REPLACE_ME`) for ACH routing/account, bank name, and `checkMailingAddress` / `CHECK_MAIL_TO`. Email/PDF will refuse to send until validation passes.

## Deploy required

```bash
source scripts/env-api-dev.sh && bash scripts/deploy.sh dev
# or targeted AppSam4 billing stack update used by your pipeline
```

After deploy, smoke:

1. Create draft invoice → expect `invoiceNumber` like `RC-2026-00001`
2. Confirm Dynamo row has `totalCents`
3. Send invoice → PDF payment block shows bank details from Secrets Manager
4. Confirm EventBridge rule `sam4-advance-billing-15th-dev` exists
