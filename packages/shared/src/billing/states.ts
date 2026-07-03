/** How this tenant is expected to pay (public-sector first). */
export type AgencyPaymentMode =
  | "invoice_only"
  | "invoice_preferred_ach"
  | "subscription_self_serve"
  | "hybrid_invoice_and_subscription";

/** Commercial lifecycle for the packaged `BillingAccount` / finance view. */
export type BillingAccountStatus =
  | "draft"
  | "trialing"
  | "current"
  | "past_due"
  | "grace"
  | "suspended"
  | "closed";

/** Subscription state for packaged billing assignments. */
export type SubscriptionLifecycleState =
  | "none"
  | "pending_start"
  | "active"
  | "scheduled_change"
  | "past_due"
  | "canceled"
  | "completed";

/** Invoice lifecycle for internal monetization invoice records. */
export type InvoiceLifecycleState =
  | "draft"
  | "unsent"
  | "sent"
  | "partially_paid"
  | "paid"
  | "voided"
  | "overdue"
  | "disputed";

/** MSA Article 4.6 + 13.5 delinquency tiers. */
export type DelinquencyTier =
  | "none"           // current
  | "warning"        // 1-30 days overdue — $50 flat fee
  | "suspended"      // 31-60 days overdue — 10-day notice + $500 reactivation
  | "terminated";    // 61+ days overdue — 15-day notice sent

export type ContractBillingCadence = "monthly" | "annual" | "custom";

export type ScheduledPlanChangeType = "upgrade" | "downgrade" | "cancel_at_period_end";
