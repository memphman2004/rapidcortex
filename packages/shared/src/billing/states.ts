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
  | "overdue";

export type DelinquencyTier = "none" | "notice" | "warning" | "critical" | "suspension_scheduled";

export type ContractBillingCadence = "monthly" | "annual" | "custom";

export type ScheduledPlanChangeType = "upgrade" | "downgrade" | "cancel_at_period_end";
