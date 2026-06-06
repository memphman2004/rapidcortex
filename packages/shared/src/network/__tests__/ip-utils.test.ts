import { describe, expect, it } from "vitest";
import {
  extractClientIp,
  ipMatchesCidrs,
  isNetworkExemptRole,
  isPrivateIp,
  isValidCidr,
  maskIpForLogging,
} from "../ip-utils.js";

describe("ip-utils", () => {
  it("validates CIDR strings", () => {
    expect(isValidCidr("203.0.113.0/24")).toBe(true);
    expect(isValidCidr("203.0.113.0")).toBe(false);
    expect(isValidCidr("not-a-cidr")).toBe(false);
  });

  it("matches IPv4 inside and outside range", () => {
    expect(ipMatchesCidrs("203.0.113.45", ["203.0.113.0/24"])).toBe(true);
    expect(ipMatchesCidrs("203.0.114.1", ["203.0.113.0/24"])).toBe(false);
    expect(ipMatchesCidrs("203.0.113.255", ["203.0.113.0/24"])).toBe(true);
  });

  it("normalizes IPv4-mapped IPv6", () => {
    expect(ipMatchesCidrs("::ffff:203.0.113.10", ["203.0.113.0/24"])).toBe(true);
  });

  it("extracts leftmost X-Forwarded-For", () => {
    const ip = extractClientIp({
      headers: { "x-forwarded-for": "203.0.113.1, 10.0.0.1" },
      requestContext: { http: { sourceIp: "10.0.0.2" } },
    });
    expect(ip).toBe("203.0.113.1");
  });

  it("masks IPv4 for logs", () => {
    expect(maskIpForLogging("203.0.113.45")).toBe("203.0.113.xxx");
  });

  it("identifies exempt RC roles", () => {
    expect(isNetworkExemptRole("rcsuperadmin")).toBe(true);
    expect(isNetworkExemptRole("dispatcher")).toBe(false);
  });

  it("detects private IPs", () => {
    expect(isPrivateIp("10.1.2.3")).toBe(true);
    expect(isPrivateIp("203.0.113.1")).toBe(false);
  });
});
