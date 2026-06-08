import { describe, expect, it } from "vitest";
import { ROLE_DASHBOARD_NAV } from "./role-dashboard-config";
import { getRoleDashboardNavTabs } from "./role-dashboard-nav";

const baseUser = {
  userId: "u1",
  agencyId: "a1",
  email: "u@test.com",
} as const;

describe("getRoleDashboardNavTabs", () => {
  it("QA nav matches analyst spec", () => {
    const tabs = getRoleDashboardNavTabs("qa", { ...baseUser, role: "analyst" });
    const ids = tabs.map((t) => t.id);
    expect(ids).toEqual(["overview", "queue", "scorecards", "transcripts", "reports"]);
  });

  it("executive nav matches auditor read-only spec", () => {
    const tabs = getRoleDashboardNavTabs("executive", { ...baseUser, role: "auditor" });
    const ids = tabs.map((t) => t.id);
    expect(ids).toEqual([
      "overview",
      "audit-log",
      "writeback",
      "reports",
      "history",
      "reviews",
    ]);
  });

  it("hospital staff nav hides admin-only tools", () => {
    const tabs = getRoleDashboardNavTabs("hospital-staff", { ...baseUser, role: "hospitalstaff" });
    const ids = tabs.map((t) => t.id);
    expect(ids).not.toContain("analytics");
    expect(ids).not.toContain("users");
    expect(ROLE_DASHBOARD_NAV["hospital-admin"].map((t) => t.id)).toContain("analytics");
  });
});
