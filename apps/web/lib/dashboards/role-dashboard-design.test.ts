import { describe, expect, it } from "vitest";
import {
  getRoleDashboardIdentity,
  ROLE_DASHBOARD_PALETTE_BY_ROLE,
  ROLE_DASHBOARD_IDENTITY,
  VERTICAL_DASHBOARD_PALETTE,
} from "./role-dashboard-design";
import type { DashboardPrefix } from "./dashboard-access";

const PREFIXES = Object.keys(ROLE_DASHBOARD_IDENTITY) as DashboardPrefix[];

/** Canonical primary accents from the role dashboard color spec. */
const SPEC_PRIMARY: Record<string, string> = {
  rcsuperadmin: "#C084FC",
  rcadmin: "#0EA5E9",
  rcitadmin: "#06B6D4",
  agencyadmin: "#10B981",
  agencyit: "#14B8A6",
  supervisor: "#F59E0B",
  dispatcher: "#3B82F6",
  analyst: "#A78BFA",
  auditor: "#F87171",
  hospitaladmin: "#F9A8D4",
  hospitalstaff: "#F9A8D4",
  venue: "#FB923C",
  campus: "#34D399",
};

describe("ROLE_DASHBOARD_IDENTITY accents", () => {
  it("maps RC platform roles to distinct palettes on the rc-admin shell", () => {
    expect(getRoleDashboardIdentity("rc-admin", "rcsuperadmin").accent).toBe("#C084FC");
    expect(getRoleDashboardIdentity("rc-admin", "rcadmin").accent).toBe("#0EA5E9");
    expect(getRoleDashboardIdentity("rc-admin", "rcitadmin").accent).toBe("#06B6D4");
  });

  it("uses role-specific palettes for each dashboard prefix default", () => {
    expect(getRoleDashboardIdentity("dispatcher").accent).toBe("#3B82F6");
    expect(getRoleDashboardIdentity("supervisor").accent).toBe("#F59E0B");
    expect(getRoleDashboardIdentity("agency-admin").accent).toBe("#10B981");
    expect(getRoleDashboardIdentity("qa").accent).toBe("#A78BFA");
    expect(getRoleDashboardIdentity("it-security").accent).toBe("#14B8A6");
    expect(getRoleDashboardIdentity("executive").accent).toBe("#F87171");
  });

  it("includes dim, badge, and text colors for every role", () => {
    for (const palette of Object.values(ROLE_DASHBOARD_PALETTE_BY_ROLE)) {
      expect(palette.dim).toMatch(/^#/);
      expect(palette.badgeBg).toMatch(/^#/);
      expect(palette.textColor).toMatch(/^#/);
    }
  });

  it("matches the published primary accent for each role", () => {
    for (const [role, accent] of Object.entries(SPEC_PRIMARY)) {
      if (role in ROLE_DASHBOARD_PALETTE_BY_ROLE) {
        expect(ROLE_DASHBOARD_PALETTE_BY_ROLE[role as keyof typeof ROLE_DASHBOARD_PALETTE_BY_ROLE].accent).toBe(
          accent,
        );
      }
    }
    expect(VERTICAL_DASHBOARD_PALETTE.venue.accent).toBe(SPEC_PRIMARY.venue);
    expect(VERTICAL_DASHBOARD_PALETTE.campus.accent).toBe(SPEC_PRIMARY.campus);
  });

  it("exposes a palette for every dashboard prefix", () => {
    for (const prefix of PREFIXES) {
      expect(ROLE_DASHBOARD_IDENTITY[prefix].accent).toMatch(/^#/);
    }
  });
});
