import { describe, expect, it } from "vitest";
import {
  collectAgencyDomains,
  extractDomainFromUrl,
  inferRoleTier,
  isPublicSafetyRelevantTitle,
} from "../contact-enrichment-shared.js";

describe("contact enrichment helpers", () => {
  it("extracts hostnames from urls", () => {
    expect(extractDomainFromUrl("https://www.muscogee911.com/about")).toBe("muscogee911.com");
    expect(extractDomainFromUrl("franklincountyohio.gov")).toBe("franklincountyohio.gov");
  });

  it("prefers .gov / .edu domains over commercial", () => {
    const domains = collectAgencyDomains([
      "https://www.muscogee911.com/staff",
      "https://franklincountyohio.gov/911",
      "https://www.grants.gov/search",
      "https://safety.osu.edu/staff",
      "https://sam.gov/opp/123",
    ]);
    expect(domains[0]).toBe("franklincountyohio.gov");
    expect(domains).toContain("safety.osu.edu");
    expect(domains).toContain("muscogee911.com");
    expect(domains).not.toContain("grants.gov");
  });

  it("scores public-safety titles", () => {
    expect(isPublicSafetyRelevantTitle("911 Communications Director")).toBe(true);
    expect(isPublicSafetyRelevantTitle("Marketing Intern")).toBe(false);
    expect(inferRoleTier("Procurement Officer")).toBe("procurement");
    expect(inferRoleTier("County Manager")).toBe("executive");
    expect(inferRoleTier("Deputy EMS Director")).toBe("secondary");
    expect(inferRoleTier("Public Safety Director")).toBe("primary");
  });
});
