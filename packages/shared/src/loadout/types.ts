export type FeatureCategory =
  | "core"
  | "intelligence"
  | "quality"
  | "field"
  | "automation"
  | "enterprise";

export interface LoadoutFeature {
  id: string;
  name: string;
  description: string;
  category: FeatureCategory;
  enterprise: boolean;
  /** Monthly base charge in CENTS. null = custom pricing (enterprise, full platform). */
  monthlyBaseCents: number | null;
  /** Calls included in monthly base. null = flat-rate (no per-call billing). */
  includedCalls: number | null;
  /** Overage rate per 1,000 calls in CENTS. null = no overage model. */
  overagePer1kCents: number | null;
  endpoint: string | null;
  enterpriseNote?: string;
}

export interface LoadoutSubscription {
  tenantId: string;
  orgName: string;
  activeFeatures: string[];
  billingEmail: string;
  technicalEmail: string;
  billingCycleDay: number;
  tier: "small" | "medium" | "large" | "enterprise";
  status: "active" | "suspended" | "cancelled";
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface LoadoutKeyRecord {
  keyHash: string;
  tenantId: string;
  keyName: string;
  status: "active" | "suspended" | "revoked";
  tier: string;
  enabledFeatures: string[];
  quotaPerFeature: Record<string, number>;
  usageThisMonth: Record<string, number>;
  allowedJurisdictions: string[];
  createdAt: string;
  lastUsedAt?: string;
}

export interface LoadoutUsageRecord {
  tenantId: string;
  featureId: string;
  period: string;
  callCount: number;
  quotaLimit: number;
  ttl: number;
}

export interface LoadoutInvoiceLineItem {
  featureId: string;
  featureName: string;
  baseCents: number;
  callsUsed: number;
  callsIncluded: number | null;
  overageCents: number;
  totalCents: number;
}

export interface LoadoutInvoice {
  invoiceId: string;
  tenantId: string;
  orgName: string;
  period: string;
  billingEmail: string;
  technicalEmail: string;
  lineItems: LoadoutInvoiceLineItem[];
  subtotalCents: number;
  totalDueCents: number;
  generatedAt: string;
  status: "generated" | "sent" | "preview" | "void";
  dueDate: string;
  ttl: number;
}
