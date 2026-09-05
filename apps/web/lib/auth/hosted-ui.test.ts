import { describe, expect, it } from "vitest";
import { safeHostedUiNextPath } from "./hosted-ui";

describe("safeHostedUiNextPath", () => {
  it("allows relative campus paths", () => {
    expect(safeHostedUiNextPath("/app/campus/IU")).toBe("/app/campus/IU");
  });

  it("rejects open redirects", () => {
    expect(safeHostedUiNextPath("https://evil.example")).toBe("/");
    expect(safeHostedUiNextPath("//evil.example")).toBe("/");
  });
});
