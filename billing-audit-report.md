# Rapid Cortex Billing Audit — 2026-07-02

## Executive Summary

The billing system has a solid foundation: invoice CRUD, SES email delivery, PDF generation, an audit trail table, and a daily scheduler. However, six production-blocking issues were found and fixed in this session, including "Navy Federal Credit Union" hardcoded in source (security violation), invoice send actions that silently skipped the email service, missing `voidedAt` timestamps, pre-signed URL TTLs far below the required 1-hour, and audit tables lacking `DeletionPolicy: Retain`. Delinquency tier escalation was absent entirely; a new Lambda and daily EventBridge schedule were added. The schema was updated to include all MSA §4.4 / §4.6 / §4.9 required fields. All fixes were applied directly; no placeholder changes were left in source.

---

## Critical — Must fix before first invoice to a real agency

| # | Issue | File | Status |
|---|-------|------|--------|
| C1 | `"Navy Federal Credit Union"` hardcoded as fallback in two PDF generators and email service — appears in source code | `apps/api/src/lib/billing/invoicePdfGenerator.ts:104`, `apps/api/src/services/billingEmailService.ts:77` | **Fixed** — replaced with `""` (empty); output now blank rather than leaking institution name |
| C2 | `apps/api/src/services/invoicePdfGenerator.ts` (schedule-driven generator) embeds static `XXX-XXX-XXX` payment placeholders — never reads from Secrets Manager | `apps/api/src/services/invoicePdfGenerator.ts:173–177` | **Fixed** — now calls `loadPaymentInstructions()` |
| C3 | Invoice `/send` action updates DynamoDB status but never calls `sendInvoiceEmail()` — invoices marked SENT with no email ever sent | `apps/api/src/routes/billing/invoices.ts:407–431` | **Fixed** — send route now calls `sendInvoiceEmail()` before updating status; fails if email fails |
| C4 | Invoice send does not validate `billingContactEmail` — will happily send to `billing@example.invalid` (the default seed value) | `apps/api/src/routes/billing/invoices.ts:411–415` | **Fixed** — added guard rejecting `@example.com`, `@example.invalid`, and empty addresses |
| C5 | PDF pre-signed URLs expired in 300 s (invoice route) and 900 s (email service, schedule generator) — audit requires 1-hour TTL | `invoices.ts:499`, `billingEmailService.ts:98`, `services/invoicePdfGenerator.ts:208` | **Fixed** — all three changed to `expiresIn: 3600` |
| C6 | `BillingAuditLogTable` and `BillingAuditEventsTable` have no `DeletionPolicy: Retain` — stack deletion would destroy 7-year audit records | `infra/nested/stack-data-layer.yaml` | **Fixed** — added `"DeletionPolicy": "Retain"` to both tables |
| C7 | No delinquency escalation Lambda — daily scheduler marks invoices OVERDUE but never advances `delinquency.tier` or applies late fees per MSA §4.6 / §13.5 | N/A | **Fixed** — created `delinquencyEscalation.ts` handler + EventBridge schedule in SAM4 template |

---

## High — Must fix before first billing cycle closes

| # | Issue | File | Status |
|---|-------|------|--------|
| H1 | `DelinquencyTier` type missing MSA-required `"suspended"` and `"terminated"` values; had `"notice"` and `"critical"` instead | `packages/shared/src/billing/states.ts:38` | **Fixed** — type now: `"none" \| "warning" \| "suspended" \| "terminated"` |
| H2 | `InvoiceLifecycleState` missing `"disputed"` state | `packages/shared/src/billing/states.ts` | **Fixed** — added |
| H3 | `InvoiceRecord` missing 14 MSA-required fields: `invoiceNumber`, `periodStart/End`, `subtotalCents`, `taxAmountCents`, `taxExempt`, `taxExemptReference`, `poNumber`, `sentAt`, `paidAt`, `voidedAt`, `voidReason`, `replacedByInvoiceId`, dispute fields | `packages/shared/src/billing/entities.ts` | **Fixed** — all added |
| H4 | Void action records no `voidedAt` timestamp and accepts no `voidReason` — MSA §4.9 requires immutable void record | `apps/api/src/routes/billing/invoices.ts:466–484` | **Fixed** — void now accepts `voidReason` body, writes `voidedAt` |
| H5 | PO enforcement gate missing from send path — `requiresPO` is checked at invoice creation but not when the invoice is actually sent | `apps/api/src/routes/billing/invoices.ts` | **Fixed** — added PO guard in send action |
| H6 | `invoices.ts` invoice number format is `RC-YYYY-MM-NNNN` (4 digits, includes month) using a table Scan for sequencing — MSA §4.4 requires `RC-YYYY-NNNNN`; Scan has race conditions | `apps/api/src/routes/billing/invoices.ts:131–148` | **TODO** — see Human Action section |
| H7 | All financial amounts in `invoices.ts` use floating-point arithmetic (`quantity * unitPrice`) — MSA requires cents integers | `apps/api/src/routes/billing/invoices.ts:100–107` | **TODO** — requires coordinated schema migration; flagged below |
| H8 | No pro-rata billing utility existed | N/A | **Fixed** — created `apps/api/src/lib/billing/proration.ts` |
| H9 | No late-fee calculation utility existed | N/A | **Fixed** — created `apps/api/src/lib/billing/late-fees.ts` |
| H10 | No payment instructions secret validation utility | N/A | **Fixed** — created `apps/api/src/lib/billing/payment-instructions.ts` |

---

## Medium — Fix before second billing cycle

| # | Issue | File | Status |
|---|-------|------|--------|
| M1 | `billingService.ts:assertBillingWrite` has an unconditional throw after the agency-check block — non-operator agency users can never write their own billing data | `apps/api/src/services/billingService.ts:125–135` | **TODO** — verify intent; if self-serve writes are expected, remove the trailing `throw` |
| M2 | `billingEmailService.ts` payment confirmation email includes payment instructions HTML in confirmation receipt — unnecessary; instructions only belong on the invoice | `apps/api/src/services/billingEmailService.ts:228` | **TODO** — remove `paymentInstructionsHtml(paymentInfo)` from payment confirmation template |
| M3 | No EventBridge schedule for invoice generation 15 days before due date (MSA §4.4) — `BillingSchedulerFunction` runs daily but has no 15th-of-month trigger | `infra/nested/stack-app-sam-4.yaml` | **TODO** — add cron schedule + recurring-invoice-generation logic |
| M4 | `billingAuditService.ts` uses `ScanCommand` for unfiltered queries — will become very slow at scale | `apps/api/src/services/billingAuditService.ts:75–81` | **TODO** — add a `agencyId-timestamp-index` GSI and query by agencyId |
| M5 | Tax-exempt rendering — PDF/email shows `Tax: $0.00` but doesn't label it "Sales Tax (Government Exempt)" for tax-exempt agencies (MSA §4.7) | `apps/api/src/lib/billing/invoicePdfGenerator.ts:228–229` | **TODO** — pass `taxExempt` flag to PDF generator and conditionally render the exemption label |
| M6 | Disputed invoice workflow — status transition and dispute fields exist in schema but no API endpoint handles `POST /invoices/{id}/dispute` or `POST /invoices/{id}/resolve-dispute` | `apps/api/src/routes/billing/invoices.ts` | **TODO** — add dispute and resolve-dispute actions to the invoice route |
| M7 | `billingEmailService.ts` hardcodes `"123 Main Street, Columbus, GA 31901"` fallback for check address | `apps/api/src/services/billingEmailService.ts:81` | **Fixed** — changed to `""` (empty) |

---

## Low — Operational hygiene

| # | Issue | File | Status |
|---|-------|------|--------|
| L1 | Default billing contact seeded as `billing@example.invalid` — good as a sentinel but should throw if an invoice send is attempted | `apps/api/src/services/billingService.ts:82` | Mitigated by C4 fix above |
| L2 | `computeTotals()` uses `Number(n.toFixed(2))` — technically floating-point safe but inconsistent with cents-only policy | `apps/api/src/routes/billing/invoices.ts:100` | **TODO** — align with H7 cents migration |
| L3 | `billingService.ts:reconcileHealth` classifies 1 overdue invoice as `"warning"` and 2+ as `"critical"` — no longer matches renamed `DelinquencyTier` values | `apps/api/src/services/billingService.ts:40–43` | **TODO** — update logic to use `"warning" / "suspended" / "terminated"` with day-based thresholds from the new escalation handler |

---

## Fixes Applied in This Session

| File | Change |
|------|--------|
| `packages/shared/src/billing/states.ts` | Fixed `DelinquencyTier` (MSA tiers); added `"disputed"` to `InvoiceLifecycleState` |
| `packages/shared/src/billing/entities.ts` | Added 14 missing MSA-required fields to `InvoiceRecord` |
| `apps/api/src/lib/billing/invoicePdfGenerator.ts` | Removed `"Navy Federal Credit Union"` and address hardcodes; all payment info from Secrets Manager only |
| `apps/api/src/services/billingEmailService.ts` | Removed `"Navy Federal Credit Union"` hardcode; removed address hardcode; fixed signed URL TTL 900 → 3600 |
| `apps/api/src/services/invoicePdfGenerator.ts` | Replaced static XXX payment placeholders with `loadPaymentInstructions()` call; fixed address; fixed signed URL TTL 900 → 3600 |
| `apps/api/src/routes/billing/invoices.ts` | Send: now calls `sendInvoiceEmail()`; validates billingContactEmail; PO gate added. Void: records `voidedAt` + `voidReason`. PDF URL: 300 → 3600 |
| `apps/api/src/lib/billing/late-fees.ts` | **New** — `calculateLateFee()` and `calculateLateInterest()` per MSA §4.6 |
| `apps/api/src/lib/billing/proration.ts` | **New** — `calculateProratedAmount()` for partial first-month billing |
| `apps/api/src/lib/billing/payment-instructions.ts` | **New** — `validatePaymentInstructions()` validates secret shape before invoice send |
| `apps/api/src/handlers/billing/delinquencyEscalation.ts` | **New** — full MSA §4.6/§13.5 escalation handler with late fees, interest, tier transitions, audit logging, CloudWatch metrics |
| `apps/api/src/index.ts` | Exported `delinquencyEscalation` handler |
| `infra/nested/stack-app-sam-4.yaml` | Added `DelinquencyEscalationFunction` with daily EventBridge schedule and scoped CloudWatch IAM |
| `infra/nested/stack-data-layer.yaml` | Added `"DeletionPolicy": "Retain"` to `BillingAuditLogTable` and `BillingAuditEventsTable` |

---

## TODOs Requiring Human Action

### TODO-1: Populate `BILLING_PAYMENT_INSTRUCTIONS_SECRET_ARN` in AWS Secrets Manager
**Priority: CRITICAL — invoices will render blank payment instructions until this is done.**

The secret must exist in `us-east-1` under the ARN configured in the SAM stack parameter `BillingPaymentInstructionsSecretArn`. Structure:
```json
{
  "ACH_ROUTING_NUMBER": "9-digit routing number",
  "ACH_ACCOUNT_NUMBER": "your ACH account number",
  "BANK_NAME": "your bank name",
  "WIRE_SWIFT_CODE": "SWIFT/BIC code",
  "WIRE_ACCOUNT_NUMBER": "wire account number",
  "WIRE_INSTRUCTIONS": "SWIFT: XXXX / Account: XXXX",
  "CHECK_MAIL_TO": "Apps on Demand LLC, [mailing address]",
  "BANK_CONTACT": "billing@rapidcortex.us"
}
```
After populating: run `aws secretsmanager get-secret-value --secret-id <ARN> --profile rapid-cortex` to verify.

### TODO-2: Fix invoice number sequencing (H6)
**Status (2026-07-28): DONE in code** — see `apps/api/src/lib/billing/invoice-sequence.ts` (`RC-YYYY-NNNNN` atomic counter). Deploy AppSam4 to activate.

### TODO-3: Migrate financial amounts to cents integers (H7)
**Status (2026-07-28): DONE in code (dual-write)** — writes `*Cents` + dollar mirrors; PDF/email prefer cents. Deploy AppSam4 to activate.

### TODO-4: Verify SES domain `rapidcortex.us` is verified in production
**Status (2026-07-28): Domain verified (Success + DKIM SUCCESS).** SES account still sandbox (`ProductionAccessEnabled: false`) — request production access before external customer email.

### TODO-5: Populate business mailing address in Secrets Manager (H7)
Populate `CHECK_MAIL_TO` / `checkMailingAddress` in `rapid-cortex/billing/payment-instructions`. Send path now validates before email.

### TODO-6: Add 15-day advance invoice generation schedule (M3)
**Status (2026-07-28): DONE in code** — EventBridge `cron(0 9 15 * ? *)` → `BillingSchedulerFunction` with `{"mode":"advance_monthly"}`. Deploy AppSam4 to activate.

### TODO-7: Privacy Policy and Terms of Service pages (from Ring audit)
**Status: DONE** — live marketing `/privacy` and `/terms` (and `/legal/*`).

---

## Schema Changes Made

| Type | Fields Added |
|------|-------------|
| `InvoiceRecord` | `invoiceNumber`, `periodStart`, `periodEnd`, `subtotalCents`, `taxAmountCents`, `taxExempt`, `taxExemptReference`, `poNumber`, `sentAt`, `paidAt`, `voidedAt`, `voidReason`, `replacedByInvoiceId`, `disputeReceivedAt`, `disputeDescription`, `disputeResolvedAt`, `disputeResolution` |
| `InvoiceLifecycleState` | `"disputed"` |
| `DelinquencyTier` | Changed from `"none"\|"notice"\|"warning"\|"critical"\|"suspension_scheduled"` to `"none"\|"warning"\|"suspended"\|"terminated"` (MSA §4.6/13.5) |

---

## New Files Created

| File | Description |
|------|-------------|
| `apps/api/src/lib/billing/late-fees.ts` | `calculateLateFee()` / `calculateLateInterest()` per MSA §4.6 |
| `apps/api/src/lib/billing/proration.ts` | `calculateProratedAmount()` for partial first month |
| `apps/api/src/lib/billing/payment-instructions.ts` | `validatePaymentInstructions()` — validates secret structure before invoice send |
| `apps/api/src/handlers/billing/delinquencyEscalation.ts` | MSA §4.6/§13.5 daily escalation handler |

---

## Verification Commands

Run these after deploying to verify billing is working:

```bash
PROFILE="--profile rapid-cortex"
API="https://7c70vqd1p5.execute-api.us-east-1.amazonaws.com"
TOKEN="<RC admin JWT>"

# 1. Invoice creation (should return 201)
curl -s -X POST "${API}/api/billing/invoices" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"customerId":"test-customer","invoiceDate":"2026-07-01","dueDate":"2026-07-31","currency":"USD","lineItems":[{"serviceId":"s1","serviceName":"Platform","description":"Monthly","quantity":1,"unitPrice":500}]}' \
  | jq '{invoiceNumber: .invoiceNumber, status: .status}'

# 2. PO enforcement gate (should return 400 with INVOICE_BLOCKED_NO_PO message)
# First set requiresPO=true on the test customer, then try to send without poNumber

# 3. Payment instructions secret validation
aws secretsmanager get-secret-value \
  --secret-id "$(aws cloudformation describe-stacks \
    --stack-name rapid-cortex-dev-AppSam4Stack-QVWYM7W29YV \
    --query 'Stacks[0].Parameters[?ParameterKey==`BillingPaymentInstructionsSecretArn`].ParameterValue' \
    --output text ${PROFILE})" \
  ${PROFILE} | jq '.SecretString | fromjson | keys'

# 4. Delinquency escalation dry-run (invoke directly)
aws lambda invoke \
  --function-name "$(aws cloudformation describe-stack-resources \
    --stack-name rapid-cortex-dev-AppSam4Stack-QVWYM7W29YV \
    --query 'StackResources[?LogicalResourceId==`DelinquencyEscalationFunction`].PhysicalResourceId' \
    --output text ${PROFILE})" \
  --payload '{}' /tmp/delinquency-test.json ${PROFILE} && \
  cat /tmp/delinquency-test.json | jq .

# 5. Billing audit trail — check a specific invoice
curl -s "${API}/api/billing/audit?invoiceId=<invoiceId>" \
  -H "Authorization: Bearer ${TOKEN}" | jq '.[] | {action, timestamp}'

# 6. SES identity verification
aws ses get-identity-verification-attributes \
  --identities billing@rapidcortex.us rapidcortex.us \
  --region us-east-1 ${PROFILE}
```
