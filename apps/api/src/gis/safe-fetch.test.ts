import { describe, expect, it } from "vitest";
import { assertGisSafeHttpsUrl, SsrfBlockedError } from "./safe-fetch.js";

describe("assertGisSafeHttpsUrl", () => {
  it("blocks link-local metadata URL before network", async () => {
    await expect(assertGisSafeHttpsUrl("http://169.254.169.254/latest/meta-data")).rejects.toBeInstanceOf(
      SsrfBlockedError,
    );
  });

  it("blocks http (HTTPS required)", async () => {
    await expect(assertGisSafeHttpsUrl("http://example.com/FeatureServer")).rejects.toBeInstanceOf(
      SsrfBlockedError,
    );
  });

  it("blocks private IPv4 literals", async () => {
    await expect(assertGisSafeHttpsUrl("https://10.0.0.1/FeatureServer")).rejects.toBeInstanceOf(
      SsrfBlockedError,
    );
  });
});
