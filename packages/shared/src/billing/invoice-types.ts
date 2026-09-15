/**
 * Types for the automated monthly invoice system.
 * Distinct from Stripe-era `InvoiceRecord` / `InvoiceLineItem` in entities.ts.
 */

import type { AutomatedBillingPlanId, DiscountType } from "./pricing-table.js";

export interface AgencyAddonConfig {
  /** Matches an ADDON_KEY from addon-types.ts or a custom key */
  key: string;
  label: string;
  /** Monthly price in cents — stored here so historical invoices are stable */
  monthlyFeeCents: number;
  /** For range-priced addons: which end of the range was agreed */
  pricingNote?: string;
  enabledAt: string;
  disabledAt?: string;
}

export interface DiscountConfig {
  type: DiscountType;
  basisPoints: number;
  label: string;
  appliesTo: "mrc" | "addons" | "total";
  expiresAt?: string;
  approvedBy: string;
}

export type BillingCycle = "monthly" | "annual";
export type ContractTermYrs = 1 | 2 | 3;

export interface AgencyBillingConfig {
  /** PK */
  agencyId: string;
  agencyName: string;
  planId: AutomatedBillingPlanId;
  billingCycle: BillingCycle;
  contractTermYears: ContractTermYrs;
  contractStartDate: string;
  contractEndDate: string;
  contractedDispatcherSeats: number;
  contractedAdminSeats: number;
  customMonthlyFeeCents?: number;
  customDispatcherOverageCents?: number;
  addons: AgencyAddonConfig[];
  discounts: DiscountConfig[];
  billingContactEmail: string;
  billingContactName: string;
  poNumber?: string;
  paymentMethod: "ach" | "wire" | "check";
  taxExempt: boolean;
  taxExemptCertNumber?: string;
  goLiveDate: string;
  status: "active" | "suspended" | "cancelled" | "pilot";
  createdAt: string;
  updatedAt: string;
}

export interface MonthlyUsageSnapshot {
  /** PK: agencyId */
  agencyId: string;
  /** SK: YYYY-MM */
  billingPeriod: string;
  activeDispatcherSeats: number;
  activeAdminSeats: number;
  totalCallsProcessed: number;
  transcriptionMinutes: number;
  translationRequests: number;
  storageGb: number;
  archiveStorageGb: number;
  photosCount: number;
  dataExportGb: number;
  snapshotAt: string;
  source: "auto" | "manual";
}

export type AutomatedInvoiceLineCategory =
  | "base_subscription"
  | "seat_overage"
  | "usage_overage"
  | "addon"
  | "support_package"
  | "discount"
  | "one_time"
  | "late_fee"
  | "pro_ration";

export interface AutomatedInvoiceLine {
  lineId: string;
  sortOrder: number;
  category: AutomatedInvoiceLineCategory;
  description: string;
  quantity: number;
  unitLabel: string;
  unitPriceCents: number;
  amountCents: number;
}

export type AutomatedInvoiceStatus =
  | "draft"
  | "sent"
  | "paid"
  | "overdue"
  | "voided"
  | "disputed";

export const AUTOMATED_INVOICE_STATUS_TRANSITIONS: Record<
  AutomatedInvoiceStatus,
  AutomatedInvoiceStatus[]
> = {
  draft: ["sent", "voided"],
  sent: ["paid", "voided", "disputed"],
  paid: [],
  overdue: ["paid", "voided", "disputed"],
  voided: [],
  disputed: ["paid", "voided", "sent"],
};

export interface AutomatedInvoice {
  /** PK — e.g. INV-202609-AGENCYID-0042 */
  invoiceId: string;
  agencyId: string;
  agencyName: string;
  billingPeriod: string;
  invoiceDate: string;
  dueDate: string;
  billingContactEmail: string;
  billingContactName: string;
  poNumber?: string;
  paymentMethod: string;
  planId: AutomatedBillingPlanId;
  planLabel: string;
  tierLabel: string;
  lines: AutomatedInvoiceLine[];
  subtotalCents: number;
  discountCents: number;
  totalCents: number;
  pricingVersion: string;
  status: AutomatedInvoiceStatus;
  sequenceNumber: number;
  emailSentAt?: string;
  paidAt?: string;
  paidByUserId?: string;
  voidedAt?: string;
  voidedByUserId?: string;
  voidReason?: string;
  replacesInvoiceId?: string;
  notes?: string;
  proRated: boolean;
  proRationDays?: number;
  proRationTotal?: number;
  createdAt: string;
  updatedAt: string;
  /** DynamoDB TTL — 7 years for government retention */
  ttl: number;
}

export interface BillingRunRecord {
  runId: string;
  billingPeriod: string;
  startedAt: string;
  completedAt?: string;
  totalAgencies: number;
  processed: number;
  failed: number;
  errors: Array<{ agencyId: string; error: string }>;
  status: "running" | "complete" | "partial_failure";
}

export interface InvoicePreviewRequest {
  agencyId: string;
  billingPeriod: string;
  usageOverride?: Partial<MonthlyUsageSnapshot>;
}

export interface InvoicePreviewResult {
  invoice: Omit<
    AutomatedInvoice,
    "invoiceId" | "sequenceNumber" | "status" | "createdAt" | "updatedAt" | "ttl"
  > & {
    invoiceId: string;
    sequenceNumber: number;
    status: AutomatedInvoiceStatus;
  };
  warnings: string[];
}
