import { describe, expect, it, vi } from "vitest";
import { isDisposableEmail, validateConsentToken } from "./homeowner-signup-guards.js";

describe("isDisposableEmail", () => {
  it("rejects known throwaway domains", () => {
    expect(isDisposableEmail("a@mailinator.com")).toBe(true);
    expect(isDisposableEmail("a@YOPMAIL.COM")).toBe(true);
    expect(isDisposableEmail("a@10minutemail.net")).toBe(true);
  });

  it("allows ordinary domains", () => {
    expect(isDisposableEmail("owner@rapidcortex.us")).toBe(false);
    expect(isDisposableEmail("person@gmail.com")).toBe(false);
  });

  it("rejects missing domains", () => {
    expect(isDisposableEmail("not-an-email")).toBe(true);
  });
});

describe("validateConsentToken", () => {
  it("rejects short or empty tokens", async () => {
    expect(await validateConsentToken("")).toBe(false);
    expect(await validateConsentToken("short")).toBe(false);
  });

  it("accepts a hashed SENT request that has not expired", async () => {
    const bcrypt = await import("bcryptjs");
    const plain = "a".repeat(24);
    const hash = await bcrypt.hash(plain, 4);
    const repo = {
      listRequestsByStatus: vi.fn(async (status: string) => {
        if (status !== "SENT") return [];
        return [
          {
            requestTokenHash: hash,
            requestStatus: "SENT",
            expiresAt: new Date(Date.now() + 60_000).toISOString(),
          },
        ];
      }),
    };
    expect(await validateConsentToken(plain, repo as never)).toBe(true);
  });

  it("rejects expired tokens", async () => {
    const bcrypt = await import("bcryptjs");
    const plain = "b".repeat(24);
    const hash = await bcrypt.hash(plain, 4);
    const repo = {
      listRequestsByStatus: vi.fn(async () => [
        {
          requestTokenHash: hash,
          requestStatus: "SENT",
          expiresAt: new Date(Date.now() - 1000).toISOString(),
        },
      ]),
    };
    expect(await validateConsentToken(plain, repo as never)).toBe(false);
  });
});
