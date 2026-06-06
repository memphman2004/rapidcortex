import type { MonetizationBillingType, AgencyPaymentMethodType } from "./plan-ids.js";
import type { MonetizationFeatureKey } from "./feature-keys.js";

/** Dynamo Plans table (+ optional seeded defaults). */
export type MonetizationPlanRecord = {
  planId: string;
  planName: string;
  publicName: string;
  description: string;
  billingType: MonetizationBillingType;
  /** Internal monthly price USD (major units); null until configured — never render publicly unless allowed. */
  baseMonthlyPrice: number | null;
  baseAnnualPrice: number | null;
  setupFee: number | null;
  implementationFee: number | null;
  cadIntegrationFee: number | null;
  includedUsers: number | null;
  includedDispatchers: number | null;
  includedSupervisors: number | null;
  includedAdmins: number | null;
  includedResponders: number | null;
  includedApiCalls: number | null;
  includedIncidents: number | null;
  includedAiSummaries: number | null;
  includedTranscriptionMinutes: number | null;
  includedTranslationMinutes: number | null;
  includedMediaSessions: number | null;
  includedCadExports: number | null;
  includedWebhookDeliveries: number | null;
  overageApiCallRate: number | null;
  overageIncidentRate: number | null;
  overageAiSummaryRate: number | null;
  overageTranscriptionMinuteRate: number | null;
  overageTranslationMinuteRate: number | null;
  overageMediaSessionRate: number | null;
  overageCadExportRate: number | null;
  supportLevel: string;
  isPublic: boolean;
  requiresQuote: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  /** Commercial product family — dashboard vs API-only SKUs. */
  productLine?: "rapid_cortex_platform" | "rc_lite_api";
  planType?: "dashboard" | "api_only" | "hybrid" | "enterprise";
  dashboardAccessEnabled?: boolean;
  apiAccessEnabled?: boolean;
  apiPortalEnabled?: boolean;
};

export type MonetizationAddOnRecord = {
  addOnId: string;
  addOnName: string;
  description: string;
  baseMonthlyPrice: number | null;
  baseAnnualPrice: number | null;
  setupFee: number | null;
  includedUsage: string | null;
  overageRate: number | null;
  requiresQuote: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type SubscriptionLifecycleStatus =
  | "active"
  | "trialing"
  | "past_due"
  | "canceled"
  | "unpaid"
  | "incomplete"
  | "none";

/** AgencySubscriptions table — one logical row per commercial subscription lifecycle. */
export type AgencySubscriptionRecord = {
  subscriptionId: string;
  agencyId: string;
  planId: string;
  addOnIds: string[];
  billingProvider?: "contract" | "manual";
  billingStatus: "draft" | "active" | "past_due" | "suspended" | "canceled";
  subscriptionStatus: SubscriptionLifecycleStatus;
  paymentMethod: AgencyPaymentMethodType;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  externalBillingSubscriptionId?: string | null;
  contractStartDate: string | null;
  contractEndDate: string | null;
  trialStartDate: string | null;
  trialEndDate: string | null;
  createdAt: string;
  updatedAt: string;
};

export type UsageMeterRecord = {
  usageMeterId: string;
  agencyId: string;
  billingPeriod: string;
  apiClientId?: string;
  incidentCount: number;
  apiCallCount: number;
  aiSummaryCount: number;
  transcriptionMinutes: number;
  translationMinutes: number;
  mediaSessionCount: number;
  cadExportCount: number;
  webhookDeliveryCount: number;
  storageGb: number;
  failedApiCalls?: number;
  /** Optional rollup of endpoint → count JSON string or map in app layer */
  endpointCountsJson?: string;
  createdAt: string;
  updatedAt: string;
};

export type MonetizationInvoiceRecord = {
  invoiceId: string;
  agencyId: string;
  subscriptionId: string;
  externalInvoiceReference?: string;
  invoiceNumber?: string;
  billingPeriod?: string;
  status: string;
  subtotal: number | null;
  total: number | null;
  dueDate?: string;
  paidAt?: string;
  paymentMethod?: AgencyPaymentMethodType;
  purchaseOrderNumber?: string;
  paymentTermsDays?: 30 | 45 | null;
  lineItems: unknown[];
  createdAt: string;
  updatedAt: string;
};

export type BillingAuditEventRecord = {
  billingAuditEventId: string;
  agencyId: string;
  actorUserId: string;
  actorRole: string;
  eventType: string;
  description: string;
  beforeState: unknown;
  afterState: unknown;
  timestamp: string;
  requestId?: string;
};

/** Superadmin/manual overrides — merged last in entitlement resolution. */
export type FeatureOverrideMap = Partial<Record<MonetizationFeatureKey, boolean>>;

export type EntitlementResolutionInput = {
  planId: string | null | undefined;
  addOnIds: readonly string[] | undefined;
  featureOverrides?: FeatureOverrideMap | null;
  monetizationAddOnDefs?: Iterable<Pick<MonetizationAddOnRecord, "addOnId" | "isActive">>;
};
