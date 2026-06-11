/**
 * apps/web/app/hospital-admin/routing/page.tsx
 */
// import { redirect } from "next/navigation";
// import { getDashboardSessionUser } from "@/lib/dashboards/get-dashboard-session";
// import { canAccessHospitalAdminPortal, canEditRoutingConfig } from "@/lib/hospital/hospital-access";
// import { HospitalAdminLayout } from "../_components/HospitalAdminLayout";
// import { HospitalRoutingClient } from "./_components/HospitalRoutingClient";
//
// export default async function HospitalRoutingPage() {
//   const user = await getDashboardSessionUser();
//   if (!user) redirect("/auth/signin");
//   if (!canAccessHospitalAdminPortal(user)) redirect("/auth/signout");
//   return (
//     <HospitalAdminLayout role={user.role}>
//       <HospitalRoutingClient agencyId={user.agencyId} canEdit={canEditRoutingConfig(user)} />
//     </HospitalAdminLayout>
//   );
// }

/**
 * apps/web/app/hospital-admin/regional-map/page.tsx
 */
// export default async function HospitalRegionalMapPage() {
//   const user = await getDashboardSessionUser();
//   if (!user) redirect("/auth/signin");
//   if (!canAccessHospitalAdminPortal(user)) redirect("/auth/signout");
//   return (
//     <HospitalAdminLayout role={user.role}>
//       <HospitalRegionalMapClient agencyId={user.agencyId} />
//     </HospitalAdminLayout>
//   );
// }

/**
 * apps/web/app/hospital-admin/analytics/page.tsx
 */
// export default async function HospitalAnalyticsPage() {
//   const user = await getDashboardSessionUser();
//   if (!user) redirect("/auth/signin");
//   if (!canAccessHospitalAdminPortal(user)) redirect("/auth/signout");
//   return (
//     <HospitalAdminLayout role={user.role}>
//       <HospitalAnalyticsClient agencyId={user.agencyId} canExport={canExportHospitalAnalytics(user)} />
//     </HospitalAdminLayout>
//   );
// }

// ─── Users and Settings (admin-only redirect guard) ───────────────────────────
// apps/web/app/hospital-admin/users/page.tsx
// apps/web/app/hospital-admin/settings/page.tsx
//
// Both pages add this guard at the top of their server component:
//
//   const user = await getDashboardSessionUser();
//   if (!user) redirect("/auth/signin");
//   if (!canAccessHospitalAdminOnlyRoutes(user)) {
//     redirect("/hospital-admin/dashboard");  // coordinator → dashboard, not 403
//   }

// ─── Tests ────────────────────────────────────────────────────────────────────

/**
 * apps/web/__tests__/hospital-coordinator.test.ts
 */

import { describe, expect, it } from "vitest";
import {
  canAccessHospitalAdminPortal,
  canAccessHospitalAdminOnlyRoutes,
  canUpdateHospitalCapacity,
  canEditRoutingConfig,
  canExportHospitalAnalytics,
  isHospitalAdminRole,
  isHospitalCoordinatorRole,
  isHospitalStaffRole,
  hospitalPostAuthRedirect,
  hospitalRoleBadge,
} from "@/lib/hospital/hospital-access";
import type { UserContext } from "rapid-cortex-shared/types";

function makeUser(role: string, agencyId = "hospital-001"): UserContext {
  return { userId: "u1", email: `${role}@hospital.org`, role: role as UserContext["role"], agencyId };
}

// ─── Role predicates ──────────────────────────────────────────────────────────

describe("hospital role predicates", () => {
  it("isHospitalAdminRole: canonical and product token", () => {
    expect(isHospitalAdminRole("HOSPITAL_ADMIN")).toBe(true);
    expect(isHospitalAdminRole("hospitaladmin")).toBe(true);
    expect(isHospitalAdminRole("HOSPITAL_COORDINATOR")).toBe(false);
    expect(isHospitalAdminRole("dispatcher")).toBe(false);
  });

  it("isHospitalCoordinatorRole", () => {
    expect(isHospitalCoordinatorRole("HOSPITAL_COORDINATOR")).toBe(true);
    expect(isHospitalCoordinatorRole("HOSPITAL_ADMIN")).toBe(false);
    expect(isHospitalCoordinatorRole("HOSPITAL_STAFF")).toBe(false);
  });

  it("isHospitalStaffRole: canonical and product token", () => {
    expect(isHospitalStaffRole("HOSPITAL_STAFF")).toBe(true);
    expect(isHospitalStaffRole("hospitalstaff")).toBe(true);
    expect(isHospitalStaffRole("HOSPITAL_ADMIN")).toBe(false);
  });
});

// ─── Portal access ────────────────────────────────────────────────────────────

describe("canAccessHospitalAdminPortal", () => {
  it("grants HOSPITAL_ADMIN", () => {
    expect(canAccessHospitalAdminPortal(makeUser("HOSPITAL_ADMIN"))).toBe(true);
  });

  it("grants HOSPITAL_COORDINATOR", () => {
    expect(canAccessHospitalAdminPortal(makeUser("HOSPITAL_COORDINATOR"))).toBe(true);
  });

  it("grants RC internal roles", () => {
    expect(canAccessHospitalAdminPortal(makeUser("rcsuperadmin", "__platform__"))).toBe(true);
    expect(canAccessHospitalAdminPortal(makeUser("rcadmin",      "__platform__"))).toBe(true);
    expect(canAccessHospitalAdminPortal(makeUser("rcitadmin",    "__platform__"))).toBe(true);
  });

  it("blocks HOSPITAL_STAFF (has own /hospital-staff portal)", () => {
    expect(canAccessHospitalAdminPortal(makeUser("HOSPITAL_STAFF"))).toBe(false);
  });

  it("blocks PSAP roles", () => {
    expect(canAccessHospitalAdminPortal(makeUser("dispatcher"))).toBe(false);
    expect(canAccessHospitalAdminPortal(makeUser("agencyadmin"))).toBe(false);
    expect(canAccessHospitalAdminPortal(makeUser("supervisor"))).toBe(false);
  });

  it("blocks venue and campus roles", () => {
    expect(canAccessHospitalAdminPortal(makeUser("VENUE_ADMIN"))).toBe(false);
    expect(canAccessHospitalAdminPortal(makeUser("CAMPUS_ADMIN"))).toBe(false);
  });
});

// ─── Admin-only routes (users, settings) ──────────────────────────────────────

describe("canAccessHospitalAdminOnlyRoutes", () => {
  it("grants HOSPITAL_ADMIN", () => {
    expect(canAccessHospitalAdminOnlyRoutes(makeUser("HOSPITAL_ADMIN"))).toBe(true);
  });

  it("grants RC internal", () => {
    expect(canAccessHospitalAdminOnlyRoutes(makeUser("rcsuperadmin", "__platform__"))).toBe(true);
  });

  it("blocks HOSPITAL_COORDINATOR — redirects to dashboard", () => {
    expect(canAccessHospitalAdminOnlyRoutes(makeUser("HOSPITAL_COORDINATOR"))).toBe(false);
  });

  it("blocks HOSPITAL_STAFF", () => {
    expect(canAccessHospitalAdminOnlyRoutes(makeUser("HOSPITAL_STAFF"))).toBe(false);
  });
});

// ─── Capacity update ──────────────────────────────────────────────────────────

describe("canUpdateHospitalCapacity", () => {
  it("admin can update", () => {
    expect(canUpdateHospitalCapacity(makeUser("HOSPITAL_ADMIN"))).toBe(true);
  });
  it("coordinator can update", () => {
    expect(canUpdateHospitalCapacity(makeUser("HOSPITAL_COORDINATOR"))).toBe(true);
  });
  it("staff can update", () => {
    expect(canUpdateHospitalCapacity(makeUser("HOSPITAL_STAFF"))).toBe(true);
  });
  it("RC internal can update", () => {
    expect(canUpdateHospitalCapacity(makeUser("rcsuperadmin", "__platform__"))).toBe(true);
  });
  it("PSAP roles cannot", () => {
    expect(canUpdateHospitalCapacity(makeUser("agencyadmin"))).toBe(false);
  });
});

// ─── Routing config edit ──────────────────────────────────────────────────────

describe("canEditRoutingConfig", () => {
  it("admin can edit", () => {
    expect(canEditRoutingConfig(makeUser("HOSPITAL_ADMIN"))).toBe(true);
  });
  it("RC internal can edit", () => {
    expect(canEditRoutingConfig(makeUser("rcsuperadmin", "__platform__"))).toBe(true);
  });
  it("coordinator gets view-only", () => {
    expect(canEditRoutingConfig(makeUser("HOSPITAL_COORDINATOR"))).toBe(false);
  });
  it("staff cannot edit", () => {
    expect(canEditRoutingConfig(makeUser("HOSPITAL_STAFF"))).toBe(false);
  });
});

// ─── Analytics export ─────────────────────────────────────────────────────────

describe("canExportHospitalAnalytics", () => {
  it("admin can export", () => {
    expect(canExportHospitalAnalytics(makeUser("HOSPITAL_ADMIN"))).toBe(true);
  });
  it("RC internal can export", () => {
    expect(canExportHospitalAnalytics(makeUser("rcadmin", "__platform__"))).toBe(true);
  });
  it("coordinator cannot export", () => {
    expect(canExportHospitalAnalytics(makeUser("HOSPITAL_COORDINATOR"))).toBe(false);
  });
  it("staff cannot export", () => {
    expect(canExportHospitalAnalytics(makeUser("HOSPITAL_STAFF"))).toBe(false);
  });
});

// ─── Post-auth redirect ───────────────────────────────────────────────────────

describe("hospitalPostAuthRedirect", () => {
  it("admin → /hospital-admin/dashboard", () => {
    expect(hospitalPostAuthRedirect("HOSPITAL_ADMIN")).toBe("/hospital-admin/dashboard");
    expect(hospitalPostAuthRedirect("hospitaladmin")).toBe("/hospital-admin/dashboard");
  });
  it("coordinator → /hospital-admin/dashboard", () => {
    expect(hospitalPostAuthRedirect("HOSPITAL_COORDINATOR")).toBe("/hospital-admin/dashboard");
  });
  it("staff → /hospital-staff/dashboard", () => {
    expect(hospitalPostAuthRedirect("HOSPITAL_STAFF")).toBe("/hospital-staff/dashboard");
    expect(hospitalPostAuthRedirect("hospitalstaff")).toBe("/hospital-staff/dashboard");
  });
  it("unknown → /auth/signout", () => {
    expect(hospitalPostAuthRedirect("dispatcher")).toBe("/auth/signout");
  });
});

// ─── Role badge ───────────────────────────────────────────────────────────────

describe("hospitalRoleBadge", () => {
  it("admin badge", () => {
    expect(hospitalRoleBadge("HOSPITAL_ADMIN")).toBe("FACILITY ADMIN");
  });
  it("coordinator badge", () => {
    expect(hospitalRoleBadge("HOSPITAL_COORDINATOR")).toBe("COORDINATOR");
  });
  it("staff badge", () => {
    expect(hospitalRoleBadge("HOSPITAL_STAFF")).toBe("STAFF");
  });
});
