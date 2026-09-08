import {
  PLATFORM_AGENCY_ID,
  isRcInternalOperator,
  resolveAgencyVerticalFromTenant,
  type AgencyLifecycleStatus,
  type AgencyTenant,
} from "rapid-cortex-shared";

/** Internal RC filter tabs — never shown in customer-facing Call Assist chrome. */
export type SwitcherVerticalFilter = "all" | "911" | "campus" | "venue";

/** Agency row for the RC-ops switcher panel. */
export type SwitcherAgency = {
  agencyId: string;
  name: string;
  /** `911` | `campus` | `venue`, or another tenant vertical (hospital/transit) with no pill. */
  vertical: string;
  active: boolean;
};

export const RC_ACTIVE_AGENCY_STORAGE_KEY = "rc_active_agency_id";

export function canMutateActiveAgency(role: string | undefined): boolean {
  if (!role) return false;
  return isRcInternalOperator(role);
}

/** Drops the platform sentinel so RC ops cannot treat `__platform__` as a tenant. */
export function persistableAgencyId(id: string | null | undefined): string | null {
  const raw = String(id ?? "").trim();
  if (!raw || raw === PLATFORM_AGENCY_ID) return null;
  return raw;
}

export function jwtTenantAgencyId(agencyId: string | null | undefined): string | null {
  return persistableAgencyId(agencyId);
}

export function resolveActiveAgencyId(opts: {
  isRcAdmin: boolean;
  jwtAgencyId: string | null | undefined;
  overrideId: string | null;
}): string | null {
  if (opts.isRcAdmin) return persistableAgencyId(opts.overrideId);
  return jwtTenantAgencyId(opts.jwtAgencyId);
}

export function switcherVerticalFromTenant(agency: Pick<AgencyTenant, "agencyId" | "type" | "vertical">): string {
  const resolved = resolveAgencyVerticalFromTenant(agency);
  if (resolved === "campus" || resolved === "venue") return resolved;
  if (resolved === "core") return "911";
  return resolved;
}

export function isSwitcherAgencyActive(status: AgencyLifecycleStatus | string | undefined): boolean {
  return status === "active" || status === "pilot";
}

export function toSwitcherAgency(
  agency: Pick<AgencyTenant, "agencyId" | "name" | "type" | "status"> & { vertical?: AgencyTenant["vertical"] },
): SwitcherAgency {
  return {
    agencyId: agency.agencyId,
    name: agency.name,
    vertical: switcherVerticalFromTenant(agency),
    active: isSwitcherAgencyActive(agency.status),
  };
}

export function matchesSwitcherFilter(
  agency: SwitcherAgency,
  filter: SwitcherVerticalFilter,
  search: string,
): boolean {
  const matchV = filter === "all" || agency.vertical === filter;
  const q = search.toLowerCase().trim();
  const matchQ =
    !q || agency.name.toLowerCase().includes(q) || agency.agencyId.toLowerCase().includes(q);
  return matchV && matchQ;
}

export function agencyInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    const a = words[0]?.[0] ?? "";
    const b = words[1]?.[0] ?? "";
    return `${a}${b}`.toUpperCase();
  }
  return name.trim().slice(0, 2).toUpperCase() || "—";
}
