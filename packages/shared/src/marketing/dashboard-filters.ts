import { z } from "zod";
import { SALES_TERRITORY_ZONES } from "../sales/sales-territory-zones.js";
import type { LeadVertical } from "../monetization/leads-crm.js";

// ─── Product Market ────────────────────────────────────────────────────────────

export const PRODUCT_MARKETS = ["psap", "campus", "venue", "transit"] as const;
export type ProductMarket = (typeof PRODUCT_MARKETS)[number];

export const PRODUCT_MARKET_LABELS: Record<ProductMarket, string> = {
  psap: "Core / PSAP",
  campus: "Campus",
  venue: "Venue",
  transit: "Transit",
};

/** Lead verticals that belong to each product market. */
const PRODUCT_MARKET_VERTICALS: Record<ProductMarket, readonly LeadVertical[]> = {
  psap: ["rc911", "law_enforcement", "fire_ems"],
  campus: ["campus"],
  venue: ["venue"],
  transit: ["transit"],
};

export function verticalsForProductMarket(market: ProductMarket): readonly LeadVertical[] {
  return PRODUCT_MARKET_VERTICALS[market];
}

export function resolveMarketingProductMarket(
  vertical: LeadVertical | undefined | null,
): ProductMarket | null {
  if (!vertical) return null;
  for (const [market, verticals] of Object.entries(PRODUCT_MARKET_VERTICALS) as [
    ProductMarket,
    readonly LeadVertical[],
  ][]) {
    if ((verticals as string[]).includes(vertical)) return market;
  }
  return null;
}

// ─── Sales Zones (all six) ─────────────────────────────────────────────────────

export const MARKETING_ZONE_IDS = [
  "zone-1",
  "zone-2",
  "zone-3",
  "zone-4",
  "zone-5",
  "zone-6",
] as const;
export type MarketingZoneId = (typeof MARKETING_ZONE_IDS)[number];

/**
 * Derive the canonical zone for a US state code, or null when unrecognised.
 * Uses the full SALES_TERRITORY_ZONES definition (zones 1–6).
 */
export function resolveSalesZoneForState(
  stateCode: string | undefined | null,
): MarketingZoneId | null {
  if (!stateCode) return null;
  const upper = stateCode.toUpperCase();
  for (const zone of SALES_TERRITORY_ZONES) {
    if ((zone.states as readonly string[]).includes(upper)) {
      return zone.id as MarketingZoneId;
    }
  }
  return null;
}

// ─── Filter Zod schema ─────────────────────────────────────────────────────────

export const MarketingDashboardFilterSchema = z.object({
  /** Filter by product market — omit for all markets */
  productMarket: z.enum(PRODUCT_MARKETS).optional(),
  /** Filter by sales zone — omit for all zones */
  zoneId: z
    .enum(MARKETING_ZONE_IDS)
    .optional(),
  /** US state code filter (two-letter uppercase) */
  state: z.string().trim().min(2).max(2).toUpperCase().optional(),
  /** County name filter (free text) */
  county: z.string().trim().max(200).optional(),
  /** Agency type filter */
  agencyType: z
    .enum(["city", "county", "municipality", "regional_center", "pilot", "state_agency", "venue", "campus", "transit"])
    .optional(),
  /** Campaign identifier / name filter */
  campaign: z.string().trim().max(200).optional(),
  /** Filter to leads assigned to a specific rep (email or userId) */
  assignedTo: z.string().trim().max(320).optional(),
  /** NexCort iQ product of interest */
  product: z.string().trim().max(200).optional(),
});

export type MarketingDashboardFilter = z.infer<typeof MarketingDashboardFilterSchema>;

/** Parse marketing dashboard filter from URL search params (returns partial on parse failure). */
export function parseMarketingDashboardFilter(
  params: Record<string, string | string[] | undefined>,
): MarketingDashboardFilter {
  const flat: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(params)) {
    flat[k] = Array.isArray(v) ? v[0] : v;
  }
  const result = MarketingDashboardFilterSchema.safeParse(flat);
  return result.success ? result.data : {};
}

/** Serialize a filter to URLSearchParams entries. */
export function serializeMarketingDashboardFilter(
  filter: MarketingDashboardFilter,
): URLSearchParams {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(filter)) {
    if (v !== undefined && v !== null && v !== "") {
      p.set(k, String(v));
    }
  }
  return p;
}
