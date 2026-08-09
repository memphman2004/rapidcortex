import { describe, expect, it } from "vitest";
import { dispatchDashboardHref } from "./dispatch-workspace-links";

describe("dispatchDashboardHref", () => {
  it("builds dispatcher deep links", () => {
    expect(dispatchDashboardHref("test-agency")).toBe("/test-agency/dispatcher");
    expect(dispatchDashboardHref("test-agency", { incidentId: "inc-1" })).toBe(
      "/test-agency/dispatcher?incident=inc-1",
    );
    expect(dispatchDashboardHref("test-agency", { queue: "non_emergency" })).toBe(
      "/test-agency/dispatcher?queue=non_emergency",
    );
  });
});
