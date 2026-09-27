/**
 * AI Feature Gate — server-side RBAC tests.
 */
import { describe, expect, it } from "vitest";
import type { UserContext } from "rapid-cortex-shared/types";
import { canReadAIGateConfig, canToggleAIGate } from "./ai-gate-authz.js";

function user(partial: Partial<UserContext> & Pick<UserContext, "role" | "agencyId">): UserContext {
  return {
    userId: partial.userId ?? "u1",
    email: partial.email ?? "u@example.com",
    ...partial,
  };
}

describe("ai-gate-authz", () => {
  it("allows supervisor toggle in-agency", () => {
    expect(canToggleAIGate(user({ role: "supervisor", agencyId: "a1" }), "a1")).toBe(true);
  });

  it("denies dispatcher toggle", () => {
    expect(canToggleAIGate(user({ role: "dispatcher", agencyId: "a1" }), "a1")).toBe(false);
  });

  it("allows dispatcher read in-agency", () => {
    expect(canReadAIGateConfig(user({ role: "dispatcher", agencyId: "a1" }), "a1")).toBe(true);
  });

  it("denies cross-agency read", () => {
    expect(canReadAIGateConfig(user({ role: "supervisor", agencyId: "a1" }), "a2")).toBe(false);
  });

  it("allows rcsuperadmin cross-tenant toggle", () => {
    expect(canToggleAIGate(user({ role: "rcsuperadmin", agencyId: "platform" }), "a1")).toBe(true);
  });
});
