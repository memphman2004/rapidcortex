import { describe, expect, it } from "vitest";
import { getCadWriteAdapter, UnknownCadVendorError } from "./index.js";

describe("getCadWriteAdapter", () => {
  it("throws on unknown vendor instead of falling back to generic", () => {
    expect(() => getCadWriteAdapter("not_a_real_vendor")).toThrow(UnknownCadVendorError);
  });

  it("resolves known vendors", () => {
    expect(getCadWriteAdapter("generic_webhook").vendor).toBe("generic_webhook");
    expect(getCadWriteAdapter("motorola_premier_one").vendor).toBe("motorola_premier_one");
  });
});
