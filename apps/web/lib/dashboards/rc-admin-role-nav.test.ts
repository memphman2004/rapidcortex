import { describe, expect, it } from "vitest";
import {
  filterRcAdminNavTabs,
  rcAdminHomeHrefForRole,
  rcAdminNavForRole,
  rcPlatformSidebarNavForRole,
} from "./rc-admin-role-nav";
import { ROLE_DASHBOARD_NAV } from "./role-dashboard-config";

describe("RC admin role navigation", () => {
  const base = ROLE_DASHBOARD_NAV["rc-admin"];

  it("routes rcitadmin home to infrastructure overview", () => {
    expect(rcAdminHomeHrefForRole("rcitadmin")).toBe("/rc-admin/infrastructure");
    expect(rcAdminHomeHrefForRole("rcsuperadmin")).toBe("/rc-admin/dashboard");
    expect(rcAdminHomeHrefForRole("rcadmin")).toBe("/rc-admin/dashboard");
  });

  describe("rcsuperadmin", () => {
    const ids = () => filterRcAdminNavTabs(base, "rcsuperadmin").map((t) => t.id);

    it("shows full platform nav including infrastructure, feature flags, and settings", () => {
      expect(ids()).toEqual([
        "overview",
        "agencies",
        "users",
        "billing",
        "infrastructure",
        "audit",
        "support",
        "feature-flags",
        "api-clients",
        "location-qr",
        "settings",
      ]);
    });

    it("does not expose roadmap-only grants nav", () => {
      expect(ids()).not.toContain("grants");
    });
  });

  describe("rcadmin", () => {
    const ids = () => filterRcAdminNavTabs(base, "rcadmin").map((t) => t.id);

    it("hides infrastructure, feature flags, and settings", () => {
      expect(ids()).not.toContain("infrastructure");
      expect(ids()).not.toContain("feature-flags");
      expect(ids()).not.toContain("settings");
      expect(ids()).toContain("service-catalog");
      expect(ids()).toContain("reports");
      expect(ids()).toContain("location-qr");
      expect(ids()).toContain("billing");
    });
  });

  describe("rcitadmin", () => {
    const ids = () => filterRcAdminNavTabs(base, "rcitadmin").map((t) => t.id);

    it("shows infrastructure-first nav without billing or feature flags", () => {
      expect(ids()).toEqual([
        "infrastructure",
        "system-health",
        "integrations",
        "users",
        "audit",
        "system-settings",
        "cad-admin",
        "security",
        "location-qr",
      ]);
    });

    it("filters jurisdiction platform sidebar for rcitadmin", () => {
      const paths = rcPlatformSidebarNavForRole("rcitadmin").map((i) => i.path);
      expect(paths).not.toContain("/rc-admin/billing");
      expect(paths).toContain("/rc-admin/infrastructure");
      expect(paths).toContain("/rc-admin/system-health");
      expect(paths).toContain("/rc-admin/security");
      expect(paths).toContain("/rc-admin/location-qr-codes");
    });
  });

  it("rcAdminNavForRole returns empty for non-RC roles", () => {
    expect(rcAdminNavForRole("dispatcher")).toEqual([]);
  });
});
