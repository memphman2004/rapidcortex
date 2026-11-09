import { describe, expect, it } from "vitest";

/** Video Assist (P2P) routes live on stack 3 — not Live Video KVS. */
describe("video assist route contracts", () => {
  it("dispatcher create/signal paths", () => {
    expect("/api/incidents/inc-1/video-assist").toMatch(/\/video-assist$/);
    expect("/api/incidents/inc-1/video-assist/sess-1/signal").toMatch(/\/video-assist\/[^/]+\/signal$/);
  });

  it("public token paths", () => {
    expect("/api/video-assist/t/tok/consent").toMatch(/\/api\/video-assist\/t\/[^/]+\//);
  });
});
