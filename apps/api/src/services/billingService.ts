import type {
  AddPaymentMethodInput,
  AgencyBillingProfile,
  ChangeSubscriptionPlanInput,
  CreateInvoiceInput,
  PatchAgencyBillingProfileInput,
  UserContext,
} from "rapid-cortex-shared";
import {
  getPlanById,
  isRcsuperadmin,
  isRcInternalOperator,
  SUBSCRIPTION_PLANS,
  type SubscriptionPlanDefinition,
} from "rapid-cortex-shared";
import { AUDIT_EVENT_TYPES } from "rapid-cortex-security";
import { makeId } from "../lib/ids.js";
import { AuditRepository } from "../repositories/auditRepository.js";
import { BillingProfileRepository } from "../repositories/billingProfileRepository.js";

const repo = new BillingProfileRepository();
const auditRepo = new AuditRepository();

function nowIso() {
  return new Date().toISOString();
}

function monthlyCents(plan: SubscriptionPlanDefinition): number {
  return plan.priceCentsMonthly ?? plan.startingPriceCentsMonthly ?? 0;
}

function reconcileHealth(
  profile: AgencyBillingProfile,
  hintReason?: string,
): Pick<AgencyBillingProfile, "delinquency" | "billingAccount"> {
  const overdueCount = profile.invoices.filter((i) => i.state === "overdue").length;
  const isSubscriptionPastDue = profile.subscription?.lifecycle === "past_due";
  const t = nowIso();

  let tier: AgencyBillingProfile["delinquency"]["tier"] = "none";
  if (overdueCount > 1) tier = "critical";
  else if (overdueCount === 1 || isSubscriptionPastDue) tier = "warning";

  const billingStatus: AgencyBillingProfile["billingAccount"]["status"] =
    tier === "none"
      ? profile.billingAccount.status === "draft"
        ? "current"
        : profile.billingAccount.status === "suspended" || profile.billingAccount.status === "closed"
          ? profile.billingAccount.status
          : "current"
      : "past_due";

  return {
    delinquency: {
      tier,
      asOf: t,
      ...(tier !== "none" && hintReason ? { reason: hintReason } : {}),
    },
    billingAccount: {
      ...profile.billingAccount,
      status: billingStatus,
      updatedAt: t,
    },
  };
}

function defaultProfile(agencyId: string): AgencyBillingProfile {
  const t = nowIso();
  return {
    agencyId,
    schemaVersion: 1,
    billingAccount: {
      billingAccountId: `bac_${agencyId}`,
      agencyId,
      status: "draft",
      preferredPaymentRail: "ach",
      createdAt: t,
      updatedAt: t,
    },
    contacts: {
      billingContactName: "Billing contact",
      billingContactEmail: "billing@example.invalid",
    },
    paymentMode: "invoice_preferred_ach",
    selfServeCheckoutEnabled: false,
    assignedPlanId: "essential",
    subscription: {
      planId: "essential",
      lifecycle: "none",
    },
    invoices: [],
    paymentMethods: [
      {
        paymentMethodId: `pm_invoice_terms_${agencyId}`,
        type: "invoice_terms",
        label: "Net-30 invoice (no card on file)",
        isDefault: true,
        createdAt: t,
      },
    ],
    delinquency: { tier: "none", asOf: t },
    createdAt: t,
    updatedAt: t,
  };
}

function upsertInvoice(
  profile: AgencyBillingProfile,
  invoice: AgencyBillingProfile["invoices"][number],
): AgencyBillingProfile {
  const rest = profile.invoices.filter((i) => i.invoiceId !== invoice.invoiceId);
  return { ...profile, invoices: [invoice, ...rest].slice(0, 100) };
}

export class BillingService {
  assertBillingRead(user: UserContext, agencyId: string): void {
    if (isRcsuperadmin(user)) return;
    if (user.agencyId !== agencyId) {
      const err = new Error("FORBIDDEN");
      (err as Error & { statusCode?: number }).statusCode = 403;
      throw err;
    }
  }

  assertBillingWrite(user: UserContext, agencyId: string): void {
    if (isRcInternalOperator(user.role)) return;
    if (user.agencyId !== agencyId) {
      const err = new Error("FORBIDDEN");
      (err as Error & { statusCode?: number }).statusCode = 403;
      throw err;
    }
    const err = new Error("FORBIDDEN");
    (err as Error & { statusCode?: number }).statusCode = 403;
    throw err;
  }

  listPlans() {
    return [...SUBSCRIPTION_PLANS];
  }

  async listInvoices(user: UserContext, agencyId: string) {
    const profile = await this.getProfile(user, agencyId);
    return [...profile.invoices];
  }

  async createInvoice(
    user: UserContext,
    agencyId: string,
    input: CreateInvoiceInput,
  ): Promise<AgencyBillingProfile> {
    this.assertBillingWrite(user, agencyId);
    const base = await this.getProfile(user, agencyId);
    const t = nowIso();
    const totalCents = input.lineItems.reduce((sum, li) => sum + li.quantity * li.unitAmountCents, 0);
    const invoice = {
      invoiceId: makeId("inv"),
      agencyId,
      state: "draft" as const,
      issueDate: t,
      dueDate: input.dueDate,
      totalCents,
      currency: "USD" as const,
      lineItems: input.lineItems.map((li) => ({
        lineId: makeId("line"),
        description: li.description,
        quantity: li.quantity,
        unitAmountCents: li.unitAmountCents,
        kind: li.kind,
        oneTimeFeeKind: li.oneTimeFeeKind,
      })),
      notes: input.notes,
      createdAt: t,
      updatedAt: t,
    };
    let next = upsertInvoice(base, invoice);
    const health = reconcileHealth(next);
    next = { ...next, delinquency: health.delinquency, billingAccount: health.billingAccount, updatedAt: t };
    await repo.put(next);
    await auditRepo.create({
      eventId: makeId("audit"),
      agencyId,
      actorId: user.userId,
      type: AUDIT_EVENT_TYPES.BILLING_PROFILE_UPDATED,
      details: { action: "invoice.created", invoiceId: invoice.invoiceId, totalCents },
      createdAt: t,
      resourceType: "billing",
      resourceId: agencyId,
    });
    return next;
  }

  async listPaymentMethods(user: UserContext, agencyId: string) {
    const profile = await this.getProfile(user, agencyId);
    return [...profile.paymentMethods];
  }

  async addPaymentMethod(
    user: UserContext,
    agencyId: string,
    input: AddPaymentMethodInput,
  ): Promise<AgencyBillingProfile> {
    this.assertBillingWrite(user, agencyId);
    const base = await this.getProfile(user, agencyId);
    const t = nowIso();
    const methodId = makeId("pm");
    const appended = {
      paymentMethodId: methodId,
      type: input.type,
      label: input.label,
      isDefault: Boolean(input.isDefault) || base.paymentMethods.length === 0,
      createdAt: t,
    };
    const methods = (base.paymentMethods ?? []).map((m) =>
      appended.isDefault ? { ...m, isDefault: false } : m,
    );
    const next = {
      ...base,
      paymentMethods: [...methods, appended],
      updatedAt: t,
    };
    await repo.put(next);
    await auditRepo.create({
      eventId: makeId("audit"),
      agencyId,
      actorId: user.userId,
      type: AUDIT_EVENT_TYPES.BILLING_PROFILE_UPDATED,
      details: { action: "payment_method.added", paymentMethodId: methodId, type: input.type },
      createdAt: t,
      resourceType: "billing",
      resourceId: agencyId,
    });
    return next;
  }

  async setDefaultPaymentMethod(
    user: UserContext,
    agencyId: string,
    paymentMethodId: string,
  ): Promise<AgencyBillingProfile> {
    this.assertBillingWrite(user, agencyId);
    const base = await this.getProfile(user, agencyId);
    const t = nowIso();
    const found = base.paymentMethods.some((m) => m.paymentMethodId === paymentMethodId);
    if (!found) {
      const err = new Error("PAYMENT_METHOD_NOT_FOUND");
      (err as Error & { statusCode?: number }).statusCode = 404;
      throw err;
    }
    const next = {
      ...base,
      paymentMethods: base.paymentMethods.map((m) => ({
        ...m,
        isDefault: m.paymentMethodId === paymentMethodId,
      })),
      updatedAt: t,
    };
    await repo.put(next);
    await auditRepo.create({
      eventId: makeId("audit"),
      agencyId,
      actorId: user.userId,
      type: AUDIT_EVENT_TYPES.BILLING_PROFILE_UPDATED,
      details: { action: "payment_method.default_set", paymentMethodId },
      createdAt: t,
      resourceType: "billing",
      resourceId: agencyId,
    });
    return next;
  }

  async getProfile(user: UserContext, agencyId: string): Promise<AgencyBillingProfile> {
    this.assertBillingRead(user, agencyId);
    const existing = await repo.get(agencyId);
    if (existing) return existing;
    const created = defaultProfile(agencyId);
    await repo.put(created);
    return created;
  }

  async patchProfile(
    user: UserContext,
    agencyId: string,
    patch: PatchAgencyBillingProfileInput,
  ): Promise<AgencyBillingProfile> {
    this.assertBillingWrite(user, agencyId);
    const base = await this.getProfile(user, agencyId);
    const t = nowIso();
    const next: AgencyBillingProfile = {
      ...base,
      billingAccount: {
        ...base.billingAccount,
        preferredPaymentRail: patch.preferredPaymentRail ?? base.billingAccount.preferredPaymentRail,
        updatedAt: t,
        status: base.billingAccount.status === "draft" ? "current" : base.billingAccount.status,
      },
      contacts: {
        ...base.contacts,
        ...("billingContactName" in patch && patch.billingContactName
          ? { billingContactName: patch.billingContactName }
          : {}),
        ...("billingContactEmail" in patch && patch.billingContactEmail
          ? { billingContactEmail: patch.billingContactEmail }
          : {}),
        ...("billingContactPhone" in patch && patch.billingContactPhone
          ? { billingContactPhone: patch.billingContactPhone }
          : {}),
        ...("accountsPayableEmail" in patch && patch.accountsPayableEmail
          ? { accountsPayableEmail: patch.accountsPayableEmail }
          : {}),
      },
      paymentMode: patch.paymentMode ?? base.paymentMode,
      selfServeCheckoutEnabled:
        patch.selfServeCheckoutEnabled ?? base.selfServeCheckoutEnabled,
      contract: base.contract
        ? {
            ...base.contract,
            purchaseOrderRef: patch.purchaseOrderRef ?? base.contract.purchaseOrderRef,
            updatedAt: t,
          }
        : patch.purchaseOrderRef
          ? {
              contractId: `ctr_${agencyId}`,
              agencyId,
              label: "Default municipal agreement",
              startDate: t,
              billingCadence: "monthly",
              autoRenew: true,
              purchaseOrderRef: patch.purchaseOrderRef,
              createdAt: t,
              updatedAt: t,
            }
          : base.contract,
      updatedAt: t,
    };

    await repo.put(next);
    await auditRepo.create({
      eventId: makeId("audit"),
      agencyId,
      actorId: user.userId,
      type: AUDIT_EVENT_TYPES.BILLING_PROFILE_UPDATED,
      details: { patch },
      createdAt: t,
      resourceType: "billing",
      resourceId: agencyId,
    });
    return next;
  }

  async changePlan(
    user: UserContext,
    agencyId: string,
    body: ChangeSubscriptionPlanInput,
  ): Promise<AgencyBillingProfile> {
    this.assertBillingWrite(user, agencyId);
    const plan = getPlanById(body.targetPlanId);
    if (!plan) {
      const err = new Error("INVALID_PLAN");
      (err as Error & { statusCode?: number }).statusCode = 400;
      throw err;
    }
    const base = await this.getProfile(user, agencyId);
    const t = nowIso();

    const prevPlan = base.assignedPlanId ? getPlanById(base.assignedPlanId) : undefined;
    const changeType =
      prevPlan && monthlyCents(plan) < monthlyCents(prevPlan) ? "downgrade" : "upgrade";

    const next: AgencyBillingProfile = {
      ...base,
      assignedPlanId: body.targetPlanId,
      subscription: {
        planId: body.targetPlanId,
        lifecycle: body.effective === "immediate" ? "active" : "scheduled_change",
        scheduledChange:
          body.effective === "period_end"
            ? {
                type: changeType,
                targetPlanId: body.targetPlanId,
                effectiveAt: base.subscription?.currentPeriodEnd ?? t,
                requestedByUserId: user.userId,
                requestedAt: t,
              }
            : undefined,
      },
      updatedAt: t,
    };

    await repo.put(next);
    await auditRepo.create({
      eventId: makeId("audit"),
      agencyId,
      actorId: user.userId,
      type: AUDIT_EVENT_TYPES.BILLING_PLAN_CHANGE_REQUESTED,
      details: {
        targetPlanId: body.targetPlanId,
        effective: body.effective,
        billingCatalogSku: plan.catalogItemSku,
      },
      createdAt: t,
      resourceType: "billing",
      resourceId: agencyId,
    });
    return next;
  }

  async cancelAtPeriodEnd(
    user: UserContext,
    agencyId: string,
    reason?: string,
  ): Promise<AgencyBillingProfile> {
    this.assertBillingWrite(user, agencyId);
    const base = await this.getProfile(user, agencyId);
    const t = nowIso();
    const next: AgencyBillingProfile = {
      ...base,
      subscription: base.subscription
        ? {
            ...base.subscription,
            lifecycle: "canceled",
            scheduledChange: {
              type: "cancel_at_period_end",
              effectiveAt: base.subscription.currentPeriodEnd ?? t,
              requestedByUserId: user.userId,
              requestedAt: t,
            },
          }
        : base.subscription,
      updatedAt: t,
    };
    await repo.put(next);
    await auditRepo.create({
      eventId: makeId("audit"),
      agencyId,
      actorId: user.userId,
      type: AUDIT_EVENT_TYPES.BILLING_SUBSCRIPTION_CANCEL_REQUESTED,
      details: { reason },
      createdAt: t,
      resourceType: "billing",
      resourceId: agencyId,
    });
    return next;
  }
}
