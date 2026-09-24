"use client";

import { useMemo } from "react";
import { isRcInternalOperator } from "rapid-cortex-shared/tenancy/principal";
import { RoleNavSections } from "@/components/navigation/role-nav-sidebar";
import { filterRoleNavByFeatures } from "@/lib/navigation/filter-role-nav";
import { getRoleNav } from "@/lib/navigation/role-nav";

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
    <nav
      className="w-full rounded-lg p-3 lg:w-64 lg:shrink-0"
      style={{
        background: "var(--rc-surface)",
        border: "1px solid var(--rc-border)",
      }}
      aria-label="Campus navigation"
    >
      <RoleNavSections nav={nav} />
    </nav>
  );
}
