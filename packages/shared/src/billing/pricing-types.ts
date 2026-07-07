export interface PricingOverrides {
  [key: string]: number;
}

export interface PricingChangeEntry {
  key: string;
  from: number;
  to: number;
}

export interface PricingAuditRecord {
  id: string;
  ts: string;
  actor: string;
  actorEmail?: string;
  scope: "global" | "tenant";
  tenantId?: string;
  tenantName?: string;
  reason: string;
  changes: PricingChangeEntry[];
}

export interface GlobalPricingConfig {
  pk: "GLOBAL";
  sk: "v1";
  overrides: PricingOverrides;
  version: number;
  lastModifiedBy: string;
  lastModifiedAt: string;
}

export interface TenantPricingConfig {
  pk: string;
  sk: "PRICING";
  agencyId: string;
  overrides: PricingOverrides;
  reason: string;
  setBy: string;
  setAt: string;
  activeFrom?: string;
  activeTo?: string;
}

export interface TenantPricingSummary {
  agencyId: string;
  agencyName: string;
  plan?: string;
  overrideCount: number;
  lastModifiedAt: string;
  setBy: string;
}
