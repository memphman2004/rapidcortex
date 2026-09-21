import { describe, expect, it } from "vitest";
import { buildPsapPopupHTML } from "./psap-overlay";

describe("buildPsapPopupHTML", () => {
  it("renders name, place, and county for hover", () => {
    const html = buildPsapPopupHTML({
      name: "Muscogee County 911",
      city: "Columbus",
      state: "GA",
      county: "Muscogee",
      cadVendor: "Motorola",
    });
    expect(html).toContain("Muscogee County 911");
    expect(html).toContain("Columbus, GA");
    expect(html).toContain("County: Muscogee");
    expect(html).toContain("CAD: Motorola");
    expect(html).toContain("PSAP");
  });

  it("escapes HTML in PSAP names", () => {
    const html = buildPsapPopupHTML({ name: "<script>alert(1)</script>" });
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });
});
