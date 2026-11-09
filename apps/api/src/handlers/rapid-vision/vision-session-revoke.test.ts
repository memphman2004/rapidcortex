import { describe, expect, it } from "vitest";

/**
 * Path contract for dispatcher session revoke (wired in vision http.ts).
 * Full handler integration needs Cognito + Dynamo; this guards the route shape.
 */
describe("vision session revoke route", () => {
  it("matches POST /api/incidents/{id}/vision/sessions/{sessionId}/revoke", () => {
    const path = "/api/incidents/inc-abc/vision/sessions/sess-xyz/revoke";
    const match = path.match(/\/api\/incidents\/([^/]+)\/vision(?:\/(.*))?$/);
    expect(match).not.toBeNull();
    const incidentId = decodeURIComponent(match![1] ?? "");
    const rest = (match![2] ?? "").split("/").filter(Boolean);
    expect(incidentId).toBe("inc-abc");
    expect(rest).toEqual(["sessions", "sess-xyz", "revoke"]);
  });
});
