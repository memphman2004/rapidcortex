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
  /** US state codes (uppercase) */
  states: string[];
  verticals: RoiVertical[];
  primaryFocus: string;
  /** Contractors currently assigned (from superadmin) */
  assignees: SalesTerritoryAssignee[];
  phone?: string;
};

/**
 * Hiring-doc Zone 1–6 coverage — static geography / focus.
 * Assignee names come from platform assignments (superadmin).
 */
export const TERRITORY_ROSTER: readonly Omit<TerritoryOwner, "assignees">[] =
  SALES_TERRITORY_ZONES.map((z) => ({
    zoneId: z.id,
    email: z.deskEmail,
    name: z.name,
    states: [...z.states],
    verticals: [...z.verticals],
    primaryFocus: z.primaryFocus,
  }));

export function mergeTerritoryRoster(
  assignments?: SalesTerritoryAssignmentsConfig | null,
): TerritoryOwner[] {
  const normalized = normalizeSalesTerritoryAssignments(
    assignments ?? emptySalesTerritoryAssignments(),
  );
  const byZone = new Map(normalized.zones.map((z) => [z.zoneId, z.assignees]));
  return TERRITORY_ROSTER.map((zone) => ({
    ...zone,
    assignees: byZone.get(zone.zoneId) ?? [],
  }));
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
