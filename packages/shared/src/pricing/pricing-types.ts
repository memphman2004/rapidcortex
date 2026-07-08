export type PriceType = "fixed" | "range" | "custom" | "included";
export type BillingPeriod = "monthly" | "annual" | "one_time" | "included" | string;
export type ServiceCategory = "core" | "addon" | "professional" | "support" | "rc_lite" | "vertical";
export type AddonSubcategory =
  | "CAD Integration"
  | "AI & Call Intelligence"
  | "Transcription & Translation"
  | "Caller Media"
  | "Supervisor & QA"
  | "Incident Command"
  | "Reliability & Tech Ops";
export type PlanTier = "essential" | "professional" | "command" | "enterprise";
export type Vertical = "campus" | "venue" | "hospital" | "transit";

export interface PriceSpec {
  priceType: PriceType;
  /** Amount in cents. Null for range/custom pricing. */
  unitPrice: number | null;
  /** Minimum price in cents (for range pricing). */
  priceMin: number | null;
  /** Maximum price in cents (for range pricing). */
  priceMax: number | null;
  billingPeriod: BillingPeriod;
  unit: string;
  plusTravel?: boolean;
  /** Annual maintenance as a decimal, e.g. 0.18 for 18%. */
  annualMaintenanceRate?: number;
}

export interface CatalogItem extends PriceSpec {
  id: string;
  name: string;
  category: ServiceCategory;
  subcategory: string;
  description: string;
  tags: string[];
  notes?: string;
  warning?: string;
  enabled: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  updatedBy?: string;
}

export interface PlanTierSpec {
  seats: string;
  callVolume: string;
  /** Monthly fee in cents. */
  monthlyFee: number;
  /** Pilot fee in cents. */
  pilotFee: number;
  /** Setup fee in cents. */
  setupFee: number;
  seatOverages: {
    dispatcherLabel: string;
    /** Per-seat overage rate in cents. */
    dispatcherRate: number;
    adminLabel: string;
    /** Per-seat overage rate in cents. */
    adminRate: number;
  };
}

export interface CorePlanItem extends CatalogItem {
  category: "core";
  plan: PlanTier;
  tierLabel: string;
  tierSpec: PlanTierSpec;
}

export interface VerticalPricingItem extends CatalogItem {
  category: "vertical";
  vertical: Vertical;
  pricingBasis: string;
}

export interface CatalogResponse {
  items: CatalogItem[];
  counts: {
    core: number;
    addon: number;
    professional: number;
    support: number;
    rc_lite: number;
    vertical: number;
    total: number;
  };
  version: number;
  updatedAt: string;
}

export interface PricingCatalogConfig {
  version: number;
  updatedAt: string;
  updatedBy: string;
  items: CatalogItem[];
}

export interface AgencyPriceOverride {
  agencyId: string;
  itemId: string;
  overridePrice: Partial<PriceSpec>;
  reason: string;
  appliedBy: string;
  appliedAt: string;
}

export type AuditAction =
  | "CONFIG_WRITE"
  | "ITEM_CREATE"
  | "ITEM_UPDATE"
  | "ITEM_DELETE"
  | "ITEM_TOGGLE"
  | "AGENCY_OVERRIDE_SET"
  | "AGENCY_OVERRIDE_CLEAR"
  | "SEED_APPLIED";

export interface PricingAuditEntry {
  pk: string;
  sk: string;
  action: AuditAction;
  userId: string;
  userEmail: string;
  reason: string;
  diff?: unknown;
  version: number;
  updatedAt: string;
}

export interface ConfigWriteRequest {
  items: CatalogItem[];
  reason: string;
}

export interface ConfigWriteResponse {
  version: number;
  updatedAt: string;
  updatedBy: string;
  itemCount: number;
}

export interface AgencyOverrideRequest {
  agencyId: string;
  itemId: string;
  overridePrice: Partial<PriceSpec>;
  reason: string;
}

export interface PricingTableRecord {
  pk: string;
  sk: string;
  item?: CatalogItem;
  version?: number;
  updatedAt?: string;
  updatedBy?: string;
}
