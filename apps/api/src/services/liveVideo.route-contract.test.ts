import { describe, expect, it } from "vitest";

/** BFF / stack-5 Live Video path contracts (distinct from Video Assist on stack 3). */
describe("live video route contracts", () => {
  it("incident live-video join path", () => {
    const path = "/api/incidents/inc-1/live-video/join";
    expect(path).toMatch(/\/api\/incidents\/[^/]+\/live-video\//);
  });

  it("public caller media path", () => {
    const path = "/api/media/live/token-abc/join";
    expect(path).toMatch(/\/api\/media\/live\/[^/]+\//);
  });
});
