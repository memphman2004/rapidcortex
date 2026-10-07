import { describe, expect, it } from "vitest";
import { assertPublicUrlLiterals, SsrfBlockedError } from "./ssrfGuard.js";

describe("assertPublicUrlLiterals", () => {
  it("allows public https origins", () => {
    const u = assertPublicUrlLiterals("https://www.rapidcortex.us/pricing");
    expect(u.hostname).toBe("www.rapidcortex.us");
  });

  it("blocks localhost", () => {
    expect(() => assertPublicUrlLiterals("http://localhost:3000/")).toThrow(SsrfBlockedError);
  });

  it("blocks private IPv4 literals", () => {
    expect(() => assertPublicUrlLiterals("http://192.168.1.1/")).toThrow(SsrfBlockedError);
    expect(() => assertPublicUrlLiterals("http://10.0.0.1/")).toThrow(SsrfBlockedError);
    expect(() => assertPublicUrlLiterals("http://169.254.169.254/latest/meta-data/")).toThrow(SsrfBlockedError);
  });

  it("blocks non-http(s) protocols", () => {
    expect(() => assertPublicUrlLiterals("file:///etc/passwd")).toThrow(SsrfBlockedError);
  });
});
