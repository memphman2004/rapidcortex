import { describe, expect, it } from "vitest";
import { ALL_JURISDICTIONS } from "../jurisdiction-registry.js";
import { UNIVERSITY_JURISDICTIONS } from "../university-registry.js";
import { textMatchesUniversityTerms, UNIVERSITY_SEARCH_TERMS } from "../university-search-terms.js";

describe("university registry", () => {
  it("includes university systems and merges into ALL_JURISDICTIONS", () => {
    expect(UNIVERSITY_JURISDICTIONS.length).toBeGreaterThan(50);
    expect(ALL_JURISDICTIONS.some((j) => j.jurisdictionId === "university_system#GA#usg")).toBe(
      true,
    );
    expect(ALL_JURISDICTIONS.some((j) => j.jurisdictionId === "university#GA#csu")).toBe(true);
    expect(ALL_JURISDICTIONS.some((j) => j.jurisdictionId === "university#GA#uga")).toBe(true);
    expect(ALL_JURISDICTIONS.some((j) => j.jurisdictionId === "university#AL#auburn")).toBe(true);
    expect(ALL_JURISDICTIONS.some((j) => j.jurisdictionId === "university#FL#uf")).toBe(true);
  });

  it("dedupes UGA to a single entry", () => {
    const uga = ALL_JURISDICTIONS.filter((j) => j.jurisdictionId === "university#GA#uga");
    expect(uga).toHaveLength(1);
    expect(uga[0]?.tier).toBe(1);
  });

  it("marks university systems as tier 0 with 12h interval (except SC system)", () => {
    const systems = UNIVERSITY_JURISDICTIONS.filter((j) => j.type === "university_system");
    expect(systems.length).toBeGreaterThanOrEqual(12);
    for (const s of systems) {
      if (s.jurisdictionId === "university_system#SC#sc-system") {
        expect(s.tier).toBe(1);
        continue;
      }
      expect(s.tier).toBe(0);
      expect(s.intervalHours).toBe(12);
    }
  });

  it("includes Columbus State as hometown campus", () => {
    const csu = UNIVERSITY_JURISDICTIONS.find((j) => j.jurisdictionId === "university#GA#csu");
    expect(csu?.name).toBe("Columbus State University");
    expect(csu?.notes?.toLowerCase()).toContain("hometown");
  });
});

describe("university search terms", () => {
  it("exports campus safety terms and matches campus text", () => {
    expect(UNIVERSITY_SEARCH_TERMS.length).toBeGreaterThan(10);
    expect(textMatchesUniversityTerms("Clery Act compliance technology RFP")).toBe(true);
    expect(textMatchesUniversityTerms("county road paving")).toBe(false);
  });
});
