import { afterEach, describe, expect, it } from "vitest";
import { assertFailClosedUnauthenticatedMode } from "../auth.js";

describe("auth security fail-closed guard", () => {
  afterEach(() => {
    delete process.env.ALLOW_UNAUTHENTICATED_API;
    delete process.env.NODE_ENV;
  });

  it("throws when unauthenticated mode is enabled outside development", () => {
    process.env.NODE_ENV = "production";
    process.env.ALLOW_UNAUTHENTICATED_API = "true";

    expect(() => assertFailClosedUnauthenticatedMode()).toThrow(
      "CJIS VIOLATION: Unauthenticated API mode not allowed in production",
    );
  });

  it("does not throw in development", () => {
    process.env.NODE_ENV = "development";
    process.env.ALLOW_UNAUTHENTICATED_API = "true";

    expect(() => assertFailClosedUnauthenticatedMode()).not.toThrow();
  });
});
