"use client";

import { useMemo } from "react";
import { campusProductFromRole } from "rapid-cortex-shared/auth/rapid-cortex-roles";
import { isRcInternalOperator } from "rapid-cortex-shared/tenancy/principal";
import { RoleNavSections } from "@/components/navigation/role-nav-sidebar";
import { filterRoleNavByFeatures } from "@/lib/navigation/filter-role-nav";
import { getRoleNav } from "@/lib/navigation/role-nav";
import { useCampusInstitutionType } from "@/lib/campus/use-campus-institution";

export function CampusNav({
  campusCode,
  role = "CAMPUS_SUPERVISOR",
  agencyId: _agencyId,
}: {
  campusCode: string;
  role?: string;
  agencyId?: string;
}) {
  const { institutionType } = useCampusInstitutionType();
  const roleProduct = campusProductFromRole(role);
  const effectiveInstitutionType = roleProduct ?? institutionType;
  // RC preview: use a product-suffixed stand-in so nav is not forced to legacy K-12.
  const navRole = isRcInternalOperator(role)
    ? effectiveInstitutionType === "k12"
      ? "CAMPUS_ADMIN_K12"
      : "CAMPUS_ADMIN_HIGHERED"
    : role;
  const nav = useMemo(
    () =>
      filterRoleNavByFeatures(
        getRoleNav(navRole, {
          campusCode: campusCode.toUpperCase(),
          campusInstitutionType: effectiveInstitutionType,
        }),
      ),
    [navRole, campusCode, effectiveInstitutionType],
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
