import { describe, expect, it } from "vitest";
import { getRoleDashboardSections } from "./role-dashboard-sections";

describe("getRoleDashboardSections", () => {
  it("shows live incident queue only for supervisor and dispatcher", () => {
    expect(getRoleDashboardSections("supervisor").liveOperationsIncidents).toBe(true);
    expect(getRoleDashboardSections("dispatcher").liveOperationsIncidents).toBe(true);
    expect(getRoleDashboardSections("qa").liveOperationsIncidents).toBe(false);
    expect(getRoleDashboardSections("agency-admin").liveOperationsIncidents).toBe(false);
    expect(getRoleDashboardSections("executive").liveOperationsIncidents).toBe(false);
    expect(getRoleDashboardSections("it-security").liveOperationsIncidents).toBe(false);
  });

  it("keeps supervisor-only widgets off dispatcher and QA dashboards", () => {
    expect(getRoleDashboardSections("dispatcher").supervisorActiveCalls).toBe(false);
    expect(getRoleDashboardSections("supervisor").supervisorActiveCalls).toBe(true);
    expect(getRoleDashboardSections("qa").supervisorActiveCalls).toBe(false);
    expect(getRoleDashboardSections("qa").qaReviewQueue).toBe(true);
  });

  it("shows QA-specific panels for analyst dashboard", () => {
    const qa = getRoleDashboardSections("qa");
    expect(qa.qaReviewQueue).toBe(true);
    expect(qa.usageChart).toBe(false);
    expect(qa.supervisorActiveCalls).toBe(false);
  });

  it("shows executive trends without ops widgets", () => {
    const exec = getRoleDashboardSections("executive");
    expect(exec.executiveTrends).toBe(true);
    expect(exec.integrationHealth).toBe(false);
    expect(exec.liveOperationsIncidents).toBe(false);
  });
});
