import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { RAPID_CORTEX_ROLES } from "rapid-cortex-shared/auth/rapid-cortex-roles";
import type { UserRole } from "rapid-cortex-shared/types";
import {
  defaultDashboardHrefForRole,
  evaluateDashboardGate,
  type DashboardPrefix,
} from "../lib/dashboards/dashboard-access";

const WEB_APP_ROOT = join(__dirname, "..");
const JURISDICTION = "demo-agency";

const JURISDICTION_HOME_PAGE: Record<UserRole, string> = {
  dispatcher: "[jurisdiction]/(dispatch)/dashboard/page.tsx",
  supervisor: "[jurisdiction]/(dispatch)/supervisor/page.tsx",
  agencyadmin: "[jurisdiction]/(dispatch)/admin/page.tsx",
  agencyit: "[jurisdiction]/(dispatch)/admin/it/page.tsx",
  analyst: "[jurisdiction]/(dispatch)/analytics/page.tsx",
  auditor: "[jurisdiction]/(dispatch)/audit/page.tsx",
  rcsuperadmin: "rc-admin/dashboard/page.tsx",
  rcadmin: "rc-admin/dashboard/page.tsx",
  rcitadmin: "rc-admin/dashboard/page.tsx",
  hospitaladmin: "hospital-admin/dashboard/page.tsx",
  hospitalstaff: "hospital-staff/dashboard/page.tsx",
};

const DASHBOARD_ROLES = RAPID_CORTEX_ROLES.filter(
  (role) => role !== "hospitaladmin" && role !== "hospitalstaff",
);

const PREFIX_BY_ROLE: Record<UserRole, DashboardPrefix> = {
  rcsuperadmin: "rc-admin",
  rcadmin: "rc-admin",
  rcitadmin: "rc-admin",
  agencyadmin: "agency-admin",
  dispatcher: "dispatcher",
  supervisor: "supervisor",
  analyst: "qa",
  agencyit: "it-security",
  auditor: "executive",
  hospitaladmin: "hospital-admin",
  hospitalstaff: "hospital-staff",
};

describe("dashboard access", () => {
  it("routes dispatcher role to jurisdiction dashboard", () => {
    expect(defaultDashboardHrefForRole("dispatcher", JURISDICTION)).toBe(
      `/${JURISDICTION}/dashboard`,
    );
  });

  it.each(DASHBOARD_ROLES)("maps %s to jurisdiction home and RBAC prefix gate", (role) => {
    const href = defaultDashboardHrefForRole(role, JURISDICTION);
    const rel = JURISDICTION_HOME_PAGE[role];
    expect(existsSync(join(WEB_APP_ROOT, "app", rel))).toBe(true);
    if (role === "rcsuperadmin" || role === "rcadmin") {
      expect(href).toBe("/rc-admin/dashboard");
    } else if (role === "rcitadmin") {
      expect(href).toBe("/rc-admin/infrastructure");
    } else {
      expect(href.startsWith(`/${JURISDICTION}/`)).toBe(true);
    }
    expect(
      evaluateDashboardGate(
        {
          userId: `u-${role}`,
          agencyId: "test-agency",
          role,
          email: `${role}@example.com`,
        },
        PREFIX_BY_ROLE[role],
      ),
    ).toBe("ok");
  });

  it("allows explicit per-user dashboard override", () => {
    const gate = evaluateDashboardGate(
      {
        userId: "u-1",
        agencyId: "agency-demo-001",
        role: "dispatcher",
        email: "dispatcher@example.com",
        dashboardAccess: "qa,supervisor",
      } satisfies import("rapid-cortex-shared/types").UserContext,
      "qa",
    );
    expect(gate).toBe("ok");
  });

  it("blocks role dashboards outside base role without override", () => {
    const gate = evaluateDashboardGate(
      {
        userId: "u-2",
        agencyId: "agency-demo-001",
        role: "dispatcher",
        email: "dispatcher@example.com",
      },
      "rc-admin",
    );
    expect(gate).toBe("forbidden");
  });

  it("allows rcsuperadmin into rc-admin dashboard", () => {
    const gate = evaluateDashboardGate(
      {
        userId: "u-rc",
        agencyId: "__platform__",
        role: "rcsuperadmin",
        email: "operator@example.com",
      },
      "rc-admin",
    );
    expect(gate).toBe("ok");
  });

  it("allows rcsuperadmin into every role dashboard prefix", () => {
    const user = {
      userId: "u-rc",
      agencyId: "__platform__",
      role: "rcsuperadmin" as const,
      email: "rcsuperadmin@appsondemand.net",
    };
    const prefixes = Object.values(PREFIX_BY_ROLE);
    for (const prefix of prefixes) {
      expect(evaluateDashboardGate(user, prefix)).toBe("ok");
    }
  });

  it.each(["hospitaladmin", "hospitalstaff"] as const)("routes %s to hospital dashboard", (role) => {
    const href = defaultDashboardHrefForRole(role, JURISDICTION);
    expect(href).toBe(
      role === "hospitaladmin" ? "/hospital-admin/dashboard" : "/hospital-staff/dashboard",
    );
    expect(existsSync(join(WEB_APP_ROOT, "app", JURISDICTION_HOME_PAGE[role]))).toBe(true);
    expect(
      evaluateDashboardGate(
        {
          userId: `u-${role}`,
          agencyId: "test-agency",
          role,
          email: `${role}@example.com`,
        },
        PREFIX_BY_ROLE[role],
      ),
    ).toBe("ok");
  });

  it("migrates legacy hospital_admin token for dashboard gate", () => {
    expect(
      evaluateDashboardGate(
        {
          userId: "u-legacy",
          agencyId: "test-agency",
          role: "hospital_admin" as unknown as UserRole,
          email: "legacy@example.com",
        },
        "hospital-admin",
      ),
    ).toBe("ok");
  });

  it("blocks dispatcher from Agency Admin dashboard (covers /agency-admin/overrides)", () => {
    const gate = evaluateDashboardGate(
      {
        userId: "u-3",
        agencyId: "agency-demo-001",
        role: "dispatcher",
        email: "dispatcher@example.com",
      },
      "agency-admin",
    );
    expect(gate).toBe("forbidden");
  });
});
