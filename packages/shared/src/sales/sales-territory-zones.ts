import { z } from "zod";
import type { RoiVertical } from "./sales-enablement-types.js";

/** Hiring-doc sales zone id (Zone 1–6). */
export const SalesTerritoryZoneIdSchema = z.enum([
  "zone-1",
  "zone-2",
  "zone-3",
  "zone-4",
  "zone-5",
  "zone-6",
]);
export type SalesTerritoryZoneId = z.infer<typeof SalesTerritoryZoneIdSchema>;

export type SalesTerritoryZoneDef = {
  id: SalesTerritoryZoneId;
  /** Display name, e.g. "Zone 1" */
  name: string;
  /** Desk alias for handoffs when no contractor is assigned */
  deskEmail: string;
  states: readonly string[];
  /** RoiVertical codes used by Sales Portal tooling */
  verticals: readonly RoiVertical[];
  /** Hiring-doc primary focus label */
  primaryFocus: string;
};

/**
 * Canonical NexCort iQ sales zones from the contractor hiring document.
 * State lists are the source of truth for Team Regions coverage.
 */
export const SALES_TERRITORY_ZONES: readonly SalesTerritoryZoneDef[] = [
  {
    id: "zone-1",
    name: "Zone 1",
    deskEmail: "zone1@nexcortiq.us",
    states: ["TX", "GA", "NC", "TN", "SC", "AL", "AR", "KS"],
    verticals: ["rc911", "transit"],
    primaryFocus: "PSAP/911 + Transit",
  },
  {
    id: "zone-2",
    name: "Zone 2",
    deskEmail: "zone2@nexcortiq.us",
    states: ["FL", "OH", "MI", "IN", "NY", "WI", "NE", "IA", "DC"],
    verticals: ["rc911", "transit", "campus"],
    primaryFocus: "PSAP/911 + Transit + Campus",
  },
  {
    id: "zone-3",
    name: "Zone 3",
    deskEmail: "zone3@nexcortiq.us",
    states: ["CA", "IL", "CO", "WA", "NV", "UT", "HI", "OR"],
    verticals: ["campus", "venue", "transit"],
    primaryFocus: "Campus + Venue + Transit",
  },
  {
    id: "zone-4",
    name: "Zone 4",
    deskEmail: "zone4@nexcortiq.us",
    states: ["KY", "MD", "VA", "CT", "DE", "RI", "OK", "MS"],
    verticals: ["campus", "venue", "rc911"],
    primaryFocus: "Campus + Venue + PSAP",
  },
  {
    id: "zone-5",
    name: "Zone 5",
    deskEmail: "zone5@nexcortiq.us",
    states: ["PA", "NJ", "MA", "MO", "MN", "LA", "AZ"],
    verticals: ["campus", "venue", "rc911"],
    primaryFocus: "Campus + Venue + PSAP",
  },
  {
    id: "zone-6",
    name: "Zone 6",
    deskEmail: "zone6@nexcortiq.us",
    states: ["AK", "ID", "ME", "MT", "NH", "NM", "ND", "SD", "VT", "WV", "WY"],
    verticals: ["rc911", "campus", "venue", "hospital", "transit"],
    primaryFocus: "Emerging & Expansion Markets",
  },
] as const;

export const SalesTerritoryAssigneeSchema = z.object({
  userId: z.string().min(1).max(200),
  email: z.string().email().max(320),
  name: z.string().min(1).max(200),
});
export type SalesTerritoryAssignee = z.infer<typeof SalesTerritoryAssigneeSchema>;

export const SalesTerritoryZoneAssignmentsSchema = z.object({
  zoneId: SalesTerritoryZoneIdSchema,
  assignees: z.array(SalesTerritoryAssigneeSchema).max(25),
});
export type SalesTerritoryZoneAssignments = z.infer<typeof SalesTerritoryZoneAssignmentsSchema>;

/** Platform settings / store payload for zone → contractor assignments. */
export const SalesTerritoryAssignmentsConfigSchema = z.object({
  zones: z.array(SalesTerritoryZoneAssignmentsSchema).max(12),
  updatedAt: z.string().min(1).max(64).optional(),
  updatedByEmail: z.string().email().max(320).optional(),
});
export type SalesTerritoryAssignmentsConfig = z.infer<
  typeof SalesTerritoryAssignmentsConfigSchema
>;

export const SALES_TERRITORY_ASSIGNMENTS_SETTING_KEY = "sales_territory_assignments";

/** Sentinel row key when persisting via the sales claims table (web BFF). */
export const SALES_TERRITORY_ASSIGNMENTS_CLAIMS_KEY = "__nexcort_sales_territories__";

export function emptySalesTerritoryAssignments(): SalesTerritoryAssignmentsConfig {
  return {
    zones: SALES_TERRITORY_ZONES.map((z) => ({ zoneId: z.id, assignees: [] })),
  };
}

export function normalizeSalesTerritoryAssignments(
  raw: SalesTerritoryAssignmentsConfig,
): SalesTerritoryAssignmentsConfig {
  const byId = new Map<SalesTerritoryZoneId, SalesTerritoryAssignee[]>();
  for (const z of SALES_TERRITORY_ZONES) byId.set(z.id, []);
  for (const row of raw.zones ?? []) {
    if (!byId.has(row.zoneId)) continue;
    const seen = new Set<string>();
    const assignees: SalesTerritoryAssignee[] = [];
    for (const a of row.assignees ?? []) {
      const email = a.email.trim().toLowerCase();
      if (!email || seen.has(email)) continue;
      seen.add(email);
      assignees.push({
        userId: a.userId.trim() || email,
        email,
        name: a.name.trim() || email,
      });
    }
    byId.set(row.zoneId, assignees);
  }
  return {
    zones: SALES_TERRITORY_ZONES.map((z) => ({
      zoneId: z.id,
      assignees: byId.get(z.id) ?? [],
    })),
    updatedAt: raw.updatedAt,
    updatedByEmail: raw.updatedByEmail,
  };
}
