import { describe, expect, it } from "vitest";
import { isAddonNotEnabledError, isOptionalFeatureForbiddenError } from "./addon-gate-errors";

describe("addon-gate-errors", () => {
  it("detects addon_not_enabled messages", () => {
    expect(isAddonNotEnabledError(new Error("addon_not_enabled"))).toBe(true);
    expect(isAddonNotEnabledError(new Error("Feature unavailable"))).toBe(true);
    expect(isAddonNotEnabledError(new Error("Request failed 500"))).toBe(false);
  });

  it("treats 403 optional-widget failures as soft-forbidden", () => {
    expect(isOptionalFeatureForbiddenError(new Error("Queue fetch failed: 403"))).toBe(true);
    expect(isOptionalFeatureForbiddenError(new Error("addon_not_enabled"))).toBe(true);
    expect(isOptionalFeatureForbiddenError(new Error("Request failed 500"))).toBe(false);
  });
});
