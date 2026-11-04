import type { RoiVertical } from "rapid-cortex-shared";
import {
  SALES_TERRITORY_ZONES,
  type SalesTerritoryAssignee,
  type SalesTerritoryAssignmentsConfig,
  type SalesTerritoryZoneId,
  emptySalesTerritoryAssignments,
  normalizeSalesTerritoryAssignments,
} from "rapid-cortex-shared";

export type TerritoryOwner = {
  /** Zone id (zone-1 … zone-6) */
  zoneId: SalesTerritoryZoneId;
  email: string;
  name: string;
  /** Primary representative label (editable by RC superadmin) */
  primaryRepresentative: string;
  /** US state codes (uppercase); editable by RC superadmin */
  states: string[];
  verticals: RoiVertical[];
  /** Focus label (editable by RC superadmin) */
  primaryFocus: string;
  /** Contractors currently assigned (from RC Admin) */
  assignees: SalesTerritoryAssignee[];
  phone?: string;
};

/**
 * Static zone shell — name / desk email / verticals.
 * Primary, focus, states, and assignees come from persisted assignments.
 */
export const TERRITORY_ROSTER: readonly Omit<
  TerritoryOwner,
  "assignees" | "primaryRepresentative" | "primaryFocus" | "states"
>[] = SALES_TERRITORY_ZONES.map((z) => ({
  zoneId: z.id,
  email: z.deskEmail,
  name: z.name,
  verticals: [...z.verticals],
}));

export function mergeTerritoryRoster(
  assignments?: SalesTerritoryAssignmentsConfig | null,
): TerritoryOwner[] {
  const normalized = normalizeSalesTerritoryAssignments(
    assignments ?? emptySalesTerritoryAssignments(),
  );
  const byZone = new Map(normalized.zones.map((z) => [z.zoneId, z]));
  return TERRITORY_ROSTER.map((zone) => {
    const row = byZone.get(zone.zoneId);
    const def = SALES_TERRITORY_ZONES.find((z) => z.id === zone.zoneId)!;
    return {
      ...zone,
      primaryRepresentative: row?.primaryRepresentative ?? def.primaryRepresentative,
      primaryFocus: row?.primaryFocus ?? def.primaryFocus,
      states: row?.states ? [...row.states] : [...def.states],
      assignees: row?.assignees ?? [],
    };
  });
}

export function ownersForState(
  state: string,
  roster: readonly TerritoryOwner[] = mergeTerritoryRoster(),
): TerritoryOwner[] {
  const s = state.trim().toUpperCase();
  return roster.filter((o) => o.states.includes(s));
}

export function ownersForEmail(
  email: string,
  roster: readonly TerritoryOwner[] = mergeTerritoryRoster(),
): TerritoryOwner | undefined {
  const e = email.trim().toLowerCase();
  return roster.find(
    (o) =>
      o.email.toLowerCase() === e ||
      o.assignees.some((a) => a.email.toLowerCase() === e),
  );
}
