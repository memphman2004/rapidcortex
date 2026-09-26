import { describe, expect, it } from "vitest";
import { matchRcsHttpRoute } from "./rcs-http-dispatch.js";

describe("matchRcsHttpRoute", () => {
  it("lists active calls", () => {
    expect(matchRcsHttpRoute("GET", "/api/rcs/calls")).toEqual({
      handler: "list",
      pathParameters: {},
    });
  });

  it("starts a call", () => {
    expect(matchRcsHttpRoute("POST", "/api/rcs/calls")).toEqual({
      handler: "start",
      pathParameters: {},
    });
  });

  it("extracts callId for nested call routes", () => {
    expect(matchRcsHttpRoute("PATCH", "/api/rcs/calls/c1/state")).toEqual({
      handler: "state",
      pathParameters: { callId: "c1" },
    });
    expect(matchRcsHttpRoute("POST", "/api/rcs/calls/c1/handoff/accept")).toEqual({
      handler: "handoff",
      pathParameters: { callId: "c1" },
    });
    expect(matchRcsHttpRoute("DELETE", "/api/rcs/calls/c1/handoff")).toEqual({
      handler: "handoff",
      pathParameters: { callId: "c1" },
    });
  });

  it("returns null for unknown RCS paths", () => {
    expect(matchRcsHttpRoute("GET", "/api/rcs/calls/c1")).toBeNull();
    expect(matchRcsHttpRoute("GET", "/api/wellness/flags")).toBeNull();
  });
});
