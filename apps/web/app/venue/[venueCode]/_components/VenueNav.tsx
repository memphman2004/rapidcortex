"use client";

import { useMemo } from "react";
import { filterRoleNavByFeatures } from "@/lib/navigation/filter-role-nav";
import { getRoleNav } from "@/lib/navigation/role-nav";
import { RoleNavSections } from "@/components/navigation/role-nav-sidebar";

export function VenueNav({ venueCode, role = "VENUE_SUPERVISOR" }: { venueCode: string; role?: string }) {
  const nav = useMemo(
    () =>
      filterRoleNavByFeatures(
        getRoleNav(role, { venueCode: venueCode.toUpperCase() }),
      ),
    [role, venueCode],
  );

  return (
    <nav className="w-full rounded-lg border border-slate-700/60 bg-slate-900/40 p-3 lg:w-64 lg:shrink-0">
      <RoleNavSections nav={nav} variant="compact" />
    </nav>
  );
}
