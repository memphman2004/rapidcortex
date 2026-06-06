import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

describe("customer readiness gate integrity", () => {
  const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..");
  const gatePath = path.resolve(repoRoot, "docs/customer-readiness-gate.md");
  const gateDoc = readFileSync(gatePath, "utf8");

  it("contains no-go hard stop for CAD write-back", () => {
    expect(gateDoc.includes("NO-GO for production CAD write-back")).toBe(true);
  });

  it("tracks P0 gates and CAD write-back hard gate", () => {
    expect(gateDoc.includes("P0 Gates")).toBe(true);
    expect(gateDoc.includes("CAD Write-Back Hard Gate")).toBe(true);
  });

  it("includes release signoff fields", () => {
    expect(gateDoc.includes("Release Signoff")).toBe(true);
    expect(gateDoc.includes("Engineering Lead")).toBe(true);
    expect(gateDoc.includes("Security Lead")).toBe(true);
  });
});
