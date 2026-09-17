import { describe, expect, it } from "vitest";
import { dashboardRouteFromRole } from "rapid-cortex-shared";

describe("Call Assist product homes", () => {
  it("routes operator and supervisor to distinct dashboards, never the 911 console", () => {
    expect(dashboardRouteFromRole("call_assist_operator", "kcpd")).toBe("/app/call-assist/operator");
    expect(dashboardRouteFromRole("call_assist_supervisor", "kcpd")).toBe("/app/call-assist/supervisor");
    expect(dashboardRouteFromRole("call_assist_admin", "kcpd")).toBe("/app/call-assist/admin");
    expect(dashboardRouteFromRole("CALL_ASSIST_SUPERVISOR", "kcpd")).toBe("/app/call-assist/supervisor");
    expect(dashboardRouteFromRole("CALL_ASSIST_OPERATOR", "kcpd")).toBe("/app/call-assist/operator");
  });
});
