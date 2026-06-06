import { describe, expect, it } from "vitest";
import { sessionPassesProductGateForPath } from "./route-gate.js";
import type { UserContext } from "../types.js";

function u(over: Partial<UserContext> & Record<string, unknown>): UserContext & Record<string, unknown> {
  return {
    userId: "u1",
    agencyId: "a1",
    role: "dispatcher",
    email: "t@example.gov",
    isSubscriber: true,
    ...over,
  } as UserContext & Record<string, unknown>;
}

describe("sessionPassesProductGateForPath", () => {
  const rcLite = u({
    planId: "rc_lite",
    role: "dispatcher",
    isSubscriber: true,
  });

  it("denies RC Lite subscriber from dispatcher operational route", () => {
    expect(sessionPassesProductGateForPath(rcLite, "/dispatcher/dashboard")).toBe(false);
  });

  it("denies RC Lite subscriber from agency-admin route", () => {
    expect(sessionPassesProductGateForPath(rcLite, "/agency-admin/billing")).toBe(false);
  });

  it("denies RC Lite subscriber from supervisor operational route", () => {
    expect(sessionPassesProductGateForPath(rcLite, "/supervisor/performance")).toBe(false);
  });

  it("allows RC Lite subscriber into RC Lite portal subtree", () => {
    expect(sessionPassesProductGateForPath(rcLite, "/rc-lite/portal")).toBe(true);
    expect(sessionPassesProductGateForPath(rcLite, "/rc-lite/portal/api-clients")).toBe(true);
  });

  it("allows Rapid Cortex platform subscriber into dispatcher prefix", () => {
    const platform = u({ planId: "essential", isSubscriber: true, role: "dispatcher" });
    expect(sessionPassesProductGateForPath(platform, "/dispatcher/workspace")).toBe(true);
  });

  it("allows RC internal operators into /rc-admin", () => {
    expect(sessionPassesProductGateForPath(u({ role: "rcsuperadmin" }), "/rc-admin/dashboard")).toBe(true);
    expect(sessionPassesProductGateForPath(u({ role: "rcadmin" }), "/rc-admin/dashboard")).toBe(true);
    expect(sessionPassesProductGateForPath(u({ role: "rcitadmin" }), "/rc-admin/dashboard")).toBe(true);
  });
});
