"use client";

import { useMemo } from "react";
import { isRcInternalOperator } from "rapid-cortex-shared/tenancy/principal";
import { filterRoleNavByFeatures } from "@/lib/navigation/filter-role-nav";
import { getRoleNav } from "@/lib/navigation/role-nav";
import { RoleNavSections } from "@/components/navigation/role-nav-sidebar";

export function CampusNav({
  campusCode,
  role = "CAMPUS_SUPERVISOR",
}: {
  campusCode: string;
  role?: string;
}) {
  const navRole = isRcInternalOperator(role) ? "CAMPUS_ADMIN" : role;
  const nav = useMemo(
    () =>
      filterRoleNavByFeatures(
        getRoleNav(navRole, { campusCode: campusCode.toUpperCase() }),
      ),
    [navRole, campusCode],
  );

  return (
    <nav className="mb-5 w-full rounded-lg border border-slate-600/40 bg-slate-900/40 p-3">
      <RoleNavSections nav={nav} variant="compact" />
    </nav>
  );
}
