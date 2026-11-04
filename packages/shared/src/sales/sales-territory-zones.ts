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

/** US states + DC allowed in sales territory coverage. */
export const SALES_TERRITORY_STATE_CODES = [
  "AL",
  "AK",
  "AZ",
  "AR",
  "CA",
  "CO",
  "CT",
  "DE",
  "DC",
  "FL",
  "GA",
  "HI",
  "ID",
  "IL",
  "IN",
  "IA",
  "KS",
  "KY",
  "LA",
  "ME",
  "MD",
  "MA",
  "MI",
  "MN",
  "MS",
  "MO",
  "MT",
  "NE",
  "NV",
  "NH",
  "NJ",
  "NM",
  "NY",
  "NC",
  "ND",
  "OH",
  "OK",
  "OR",
  "PA",
  "RI",
  "SC",
  "SD",
  "TN",
  "TX",
  "UT",
  "VT",
  "VA",
  "WA",
  "WV",
  "WI",
  "WY",
] as const;

const SALES_TERRITORY_STATE_SET = new Set<string>(SALES_TERRITORY_STATE_CODES);

export type SalesTerritoryZoneDef = {
  id: SalesTerritoryZoneId;
  /** Display name, e.g. "Zone 1" */
  name: string;
  /** Desk alias for handoffs when no contractor is assigned */
  deskEmail: string;
  /** Default primary representative label (person name or Reserve/Expansion) */
  primaryRepresentative: string;
  states: readonly string[];
  /** RoiVertical codes used by Sales Portal tooling */
  verticals: readonly RoiVertical[];
  /** Default primary focus label */
  primaryFocus: string;
};

/**
 * Canonical NexCort iQ sales zones — defaults for Team Regions.
 * Superadmin may override primaryRepresentative, primaryFocus, and states
 * via persisted SalesTerritoryAssignmentsConfig.
 */
export const SALES_TERRITORY_ZONES: readonly SalesTerritoryZoneDef[] = [
  {
    id: "zone-1",
    name: "Zone 1",
    deskEmail: "zone1@nexcortiq.us",
    primaryRepresentative: "Eric",
    states: ["TX", "GA", "NC", "TN", "SC", "AL", "AR", "KS", "MO", "LA"],
    verticals: ["rc911", "transit"],
    primaryFocus: "PSAP/911 + Transit",
  },
  {
    id: "zone-2",
    name: "Zone 2",
    deskEmail: "zone2@nexcortiq.us",
    primaryRepresentative: "Dilaine",
    states: ["FL", "OH", "MI", "IN", "NY", "WI", "NE", "IA", "DC", "MA", "MN"],
    verticals: ["rc911", "transit", "campus"],
    primaryFocus: "PSAP/911 + Transit + Campus",
  },
  {
    id: "zone-3",
    name: "Zone 3",
    deskEmail: "zone3@nexcortiq.us",
    primaryRepresentative: "Kirk",
    states: ["CA", "IL", "CO", "WA", "NV", "UT", "HI", "OR", "AZ"],
    verticals: ["campus", "venue", "transit"],
    primaryFocus: "Campus + Venue + Transit",
  },
  {
    id: "zone-4",
    name: "Zone 4",
    deskEmail: "zone4@nexcortiq.us",
    primaryRepresentative: "Markeise",
    states: ["KY", "MD", "VA", "CT", "DE", "RI", "OK", "MS", "PA", "NJ"],
    verticals: ["campus", "venue", "rc911"],
    primaryFocus: "Campus + Venue + PSAP",
  },
  {
    id: "zone-5",
    name: "Zone 5",
    deskEmail: "zone5@nexcortiq.us",
    primaryRepresentative: "Reserve",
    states: [],
    verticals: [],
    primaryFocus: "Future sales representative",
  },
  {
    id: "zone-6",
    name: "Zone 6",
    deskEmail: "zone6@nexcortiq.us",
    primaryRepresentative: "Expansion",
    states: ["AK", "ID", "ME", "MT", "NH", "NM", "ND", "SD", "VT", "WV", "WY"],
    verticals: ["rc911", "campus", "venue", "hospital", "transit"],
    primaryFocus: "Emerging markets",
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
  /** Editable by RC superadmin; falls back to hiring-doc default when omitted. */
  primaryRepresentative: z.string().min(1).max(200).optional(),
  /** Editable by RC superadmin; falls back to hiring-doc default when omitted. */
  primaryFocus: z.string().min(1).max(300).optional(),
  /** Editable by RC superadmin; falls back to hiring-doc default when omitted. */
  states: z.array(z.string().min(2).max(2)).max(60).optional(),
});
export type SalesTerritoryZoneAssignments = z.infer<typeof SalesTerritoryZoneAssignmentsSchema>;

/** Platform settings / store payload for zone → contractor assignments + editable coverage. */
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

/** Normalize a free-text / CSV state list into unique uppercase US+DC codes. */
export function parseSalesTerritoryStates(input: string | readonly string[]): string[] {
  const raw = typeof input === "string" ? input.split(/[\s,;|/]+/) : input;
  const seen = new Set<string>();
  const out: string[] = [];
  for (const token of raw) {
    const code = String(token ?? "")
      .trim()
      .toUpperCase();
    if (!code || !SALES_TERRITORY_STATE_SET.has(code) || seen.has(code)) continue;
    seen.add(code);
    out.push(code);
  }
  return out;
}

export function emptySalesTerritoryAssignments(): SalesTerritoryAssignmentsConfig {
  return {
    zones: SALES_TERRITORY_ZONES.map((z) => ({
      zoneId: z.id,
      assignees: [],
      primaryRepresentative: z.primaryRepresentative,
      primaryFocus: z.primaryFocus,
      states: [...z.states],
    })),
  };
}

/**
 * Fill missing zone rows from hiring-doc defaults, normalize assignees/states,
 * and ensure each state appears in at most one zone (earlier zone wins).
 */
export function normalizeSalesTerritoryAssignments(
  raw: SalesTerritoryAssignmentsConfig,
): SalesTerritoryAssignmentsConfig {
  type ZoneRow = {
    assignees: SalesTerritoryAssignee[];
    primaryRepresentative: string;
    primaryFocus: string;
    states: string[];
  };

  const byId = new Map<SalesTerritoryZoneId, ZoneRow>();
  for (const z of SALES_TERRITORY_ZONES) {
    byId.set(z.id, {
      assignees: [],
      primaryRepresentative: z.primaryRepresentative,
      primaryFocus: z.primaryFocus,
      states: [...z.states],
    });
  }

  for (const row of raw.zones ?? []) {
    if (!byId.has(row.zoneId)) continue;
    const def = SALES_TERRITORY_ZONES.find((z) => z.id === row.zoneId)!;
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

    const primaryRepresentative =
      typeof row.primaryRepresentative === "string" && row.primaryRepresentative.trim()
        ? row.primaryRepresentative.trim().slice(0, 200)
        : def.primaryRepresentative;
    const primaryFocus =
      typeof row.primaryFocus === "string" && row.primaryFocus.trim()
        ? row.primaryFocus.trim().slice(0, 300)
        : def.primaryFocus;
    const states =
      row.states !== undefined
        ? parseSalesTerritoryStates(row.states)
        : [...def.states];

    byId.set(row.zoneId, {
      assignees,
      primaryRepresentative,
      primaryFocus,
      states,
    });
  }

  // One state → one zone (zone-1 … zone-6 order keeps first claim).
  const claimed = new Set<string>();
  const zones = SALES_TERRITORY_ZONES.map((z) => {
    const row = byId.get(z.id)!;
    const states = row.states.filter((s) => {
      if (claimed.has(s)) return false;
      claimed.add(s);
      return true;
    });
    return {
      zoneId: z.id,
      assignees: row.assignees,
      primaryRepresentative: row.primaryRepresentative,
      primaryFocus: row.primaryFocus,
      states,
    };
  });

  return {
    zones,
    updatedAt: raw.updatedAt,
    updatedByEmail: raw.updatedByEmail,
  };
}
