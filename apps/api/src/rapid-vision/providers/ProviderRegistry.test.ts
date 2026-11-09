import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../lib/env.js", () => ({
  env: {
    enableRapidVisionCallerVideo: true,
  },
}));

vi.mock("../../repositories/liveVideoRepository.js", () => ({
  LiveVideoRepository: class {
    async getByIncidentId() {
      return null;
    }
  },
}));

describe("getVisionProvider", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("returns demo and caller_video; never Nest/Wyze", async () => {
    const { getVisionProvider } = await import("./ProviderRegistry.js");
    expect(getVisionProvider("demo")?.identity.provider).toBe("demo");
    expect(getVisionProvider("caller_video")?.identity.provider).toBe("caller_video");
    // Nest/Wyze are Connect-only — not VisionProvider enum members.
    expect(getVisionProvider("rtsp" as never)).toBeNull();
  });
});
