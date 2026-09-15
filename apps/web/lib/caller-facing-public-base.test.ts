import { afterEach, describe, expect, it, vi } from "vitest";
import { callerFacingPublicBaseUrl } from "./caller-facing-public-base";

describe("callerFacingPublicBaseUrl", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns the browser origin without a trailing slash", () => {
    vi.stubGlobal("window", { location: { origin: "https://app.rapidcortex.us" } });
    expect(callerFacingPublicBaseUrl()).toBe("https://app.rapidcortex.us");
  });
});
