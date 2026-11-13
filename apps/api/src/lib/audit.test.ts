import { describe, expect, it } from "vitest";
import { extractIp } from "./audit.js";

describe("extractIp", () => {
  it("prefers API Gateway v2 sourceIp", () => {
    expect(
      extractIp({
        requestContext: { http: { sourceIp: "203.0.113.10" } },
        headers: { "x-forwarded-for": "198.51.100.1, 203.0.113.10" },
      }),
    ).toBe("203.0.113.10");
  });

  it("falls back to first x-forwarded-for hop", () => {
    expect(
      extractIp({
        requestContext: { http: {} },
        headers: { "x-forwarded-for": "198.51.100.7, 10.0.0.1" },
      }),
    ).toBe("198.51.100.7");
  });

  it("returns unknown when no IP is present", () => {
    expect(extractIp({ requestContext: {}, headers: {} })).toBe("unknown");
  });
});
