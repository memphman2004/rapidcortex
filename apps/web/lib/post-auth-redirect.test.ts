import { describe, expect, it } from "vitest";
import { getPostAuthRedirect } from "./post-auth-redirect";

describe("getPostAuthRedirect", () => {
  it("sends field_responder to /responder (not /dashboard)", () => {
    expect(
      getPostAuthRedirect({
        role: "field_responder",
        agencyId: "test-agency",
      }),
    ).toBe("/responder");
  });

  it("sends each responder subtype claim path via field_responder role", () => {
    expect(
      getPostAuthRedirect({
        role: "field_responder",
        agencyId: "test-agency",
        vertical: "responder",
      }),
    ).toBe("/responder");
  });

  it("keeps PSAP dispatcher on the dashboard hub", () => {
    expect(
      getPostAuthRedirect({
        role: "dispatcher",
        agencyId: "test-agency",
      }),
    ).toBe("/dashboard");
  });

  it("honors a safe next param", () => {
    expect(
      getPostAuthRedirect(
        { role: "field_responder", agencyId: "test-agency" },
        "/responder/incidents",
      ),
    ).toBe("/responder/incidents");
  });
});
