import { describe, expect, it } from "vitest";
import { ROLE_DASHBOARD_NAV } from "./role-dashboard-config";
import { getRoleDashboardNavTabs } from "./role-dashboard-nav";

const baseUser = {
  userId: "u1",
  agencyId: "a1",
  email: "u@test.com",
} as const;

describe("getRoleDashboardNavTabs", () => {
  it("QA nav excludes supervisor coaching/scorecards crossover", () => {
    const tabs = getRoleDashboardNavTabs("qa", { ...baseUser, role: "analyst" });
    const ids = tabs.map((t) => t.id);
    expect(ids).not.toContain("scorecards");
    expect(ids).not.toContain("coaching");
    expect(ids).not.toContain("training");
    expect(ids).toEqual(["overview", "transcripts", "summaries", "reports"]);
  });

  it("executive nav excludes supervisor QA and admin analytics crossover", () => {
    const tabs = getRoleDashboardNavTabs("executive", { ...baseUser, role: "auditor" });
    const ids = tabs.map((t) => t.id);
    expect(ids).not.toContain("qa");
    expect(ids).not.toContain("usage");
    expect(ids).toEqual(["overview", "reports", "grants", "export"]);
  });

  it("hospital staff nav hides admin-only tools", () => {
    const tabs = getRoleDashboardNavTabs("hospital-staff", { ...baseUser, role: "hospitalstaff" });
    const ids = tabs.map((t) => t.id);
    expect(ids).not.toContain("analytics");
    expect(ids).not.toContain("users");
    expect(ROLE_DASHBOARD_NAV["hospital-admin"].map((t) => t.id)).toContain("analytics");
  });
});
