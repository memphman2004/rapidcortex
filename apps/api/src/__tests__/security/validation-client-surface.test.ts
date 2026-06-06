import { describe, expect, it, vi, afterEach } from "vitest";
import { z } from "zod";
import { validationErrorMessageForClient } from "../../lib/zod-client-error.js";

describe("validationErrorMessageForClient", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("hides Zod path details in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    const err = z.object({ secretField: z.string() }).safeParse({}).error!;
    expect(validationErrorMessageForClient(err)).toBe("Invalid request");
  });

  it("returns Zod message in development", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("RC_HIDE_VALIDATION_DETAILS", "");
    const err = z.object({ a: z.number() }).safeParse({ a: "x" }).error!;
    expect(validationErrorMessageForClient(err)).toContain("Expected number");
  });

  it("hides details when RC_HIDE_VALIDATION_DETAILS is true", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("RC_HIDE_VALIDATION_DETAILS", "true");
    const err = z.object({ a: z.number() }).safeParse({}).error!;
    expect(validationErrorMessageForClient(err)).toBe("Invalid request");
  });
});
