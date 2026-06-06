import type {
  AgencyPaymentMode,
  BillingAccountStatus,
  ContractBillingCadence,
  DelinquencyTier,
  InvoiceLifecycleState,
  ScheduledPlanChangeType,
  SubscriptionLifecycleState,
} from "./states.js";
import type { OneTimeFeeKind, SubscriptionPlanId } from "./catalog.js";
import type { TenantEntitlements } from "./addon-types.js";

/** Finance / AR identity (internal reconciliation + legacy external ids). */
export type BillingAccount = {
  billingAccountId: string;
  agencyId: string;
  status: BillingAccountStatus;
  /** Archived external billing customer id from imports / legacy payloads. */
  archivedExternalCustomerId?: string;
  /** Preferred: ACH bank account for B2B / public-sector. */
  preferredPaymentRail: "ach" | "card" | "invoice_only";
  createdAt: string;
  updatedAt: string;
};

export type PaymentMethod = {
  paymentMethodId: string;
  type: "ach_bank_account" | "card_on_file" | "invoice_terms";
  label: string;
  /** Archived token reference from imports / legacy vault rows. */
  archivedExternalPaymentMethodRef?: string;
  isDefault: boolean;
  createdAt: string;
};

export type InvoiceLineItem = {
  lineId: string;
  description: string;
  quantity: number;
  unitAmountCents: number;
  kind: "subscription" | "one_time_fee" | "adjustment";
  oneTimeFeeKind?: OneTimeFeeKind;
};

export type InvoiceRecord = {
  invoiceId: string;
  agencyId: string;
  state: InvoiceLifecycleState;
  /** Archived external invoice id from imports / finance bridges. */
  archivedExternalInvoiceId?: string;
  issueDate: string;
  dueDate: string;
  totalCents: number;
  currency: "USD";
  lineItems: InvoiceLineItem[];
  notes?: string;
  createdAt: string;
  updatedAt: string;
};

export type SubscriptionPlanAssignment = {
  planId: SubscriptionPlanId;
  lifecycle: SubscriptionLifecycleState;
  /** Archived external subscription id from imports / finance bridges. */
  archivedExternalSubscriptionId?: string;
  currentPeriodStart?: string;
  currentPeriodEnd?: string;
  /** When set, change applies at `effectiveAt` (coarse model for upgrades/downgrades). */
  scheduledChange?: {
    type: ScheduledPlanChangeType;
    targetPlanId?: SubscriptionPlanId;
    effectiveAt: string;
    requestedByUserId: string;
    requestedAt: string;
  };
};

export type ContractTerm = {
  contractId: string;
  agencyId: string;
  label: string;
  startDate: string;
  endDate?: string;
  billingCadence: ContractBillingCadence;
  autoRenew: boolean;
  /** Procurement / PO reference (not PAN). */
  purchaseOrderRef?: string;
  createdAt: string;
  updatedAt: string;
};

/** Billing + remittance contacts (may differ from operational `AgencyTenant` contacts). */
export type AgencyBillingContacts = {
  billingContactName: string;
  billingContactEmail: string;
  billingContactPhone?: string;
  accountsPayableEmail?: string;
  remittanceAddressLines?: string[];
};

/**
 * Single Dynamo item per agency (`agencyId` PK) — v1 embedded ledger (trim with archival job later).
 */
export type AgencyBillingProfile = {
  agencyId: string;
  schemaVersion: 1;
  billingAccount: BillingAccount;
  contacts: AgencyBillingContacts;
  paymentMode: AgencyPaymentMode;
  /** If false, UI hides self-serve checkout. */
  selfServeCheckoutEnabled: boolean;
  assignedPlanId?: SubscriptionPlanId;
  subscription?: SubscriptionPlanAssignment;
  contract?: ContractTerm;
  /** Latest invoices (newest first); full history can move to child items later. */
  invoices: InvoiceRecord[];
  paymentMethods: PaymentMethod[];
  delinquency: {
    tier: DelinquencyTier;
    asOf: string;
    reason?: string;
  };
  /** Per-tenant feature add-on entitlements (RC admin managed). */
  tenantEntitlements?: TenantEntitlements;
  createdAt: string;
  updatedAt: string;
};
