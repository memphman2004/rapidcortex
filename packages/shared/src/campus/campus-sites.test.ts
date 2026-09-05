import { describe, expect, it } from "vitest";
import {
  CAMPUS_SITE_SCOPE_ALL,
  campusSitesPutSchema,
  matchesCampusSiteScope,
  normalizeCampusSiteCode,
  resolveCampusSites,
} from "./campus-sites.js";

describe("campus sites", () => {
  it("normalizes codes to alphanumeric uppercase", () => {
    expect(normalizeCampusSiteCode("iu-bloomington")).toBe("IUBLOOMINGTON");
    expect(normalizeCampusSiteCode(" IUPUI ")).toBe("IUPUI");
  });

  it("synthesizes a primary site when none are stored", () => {
    const resolved = resolveCampusSites(undefined, "iu", "Indiana University");
    expect(resolved.primarySiteCode).toBe("IU");
    expect(resolved.sites).toEqual([
      { code: "IU", name: "Indiana University", active: true },
    ]);
  });

  it("prepends the tenant campus code when the stored list omits it", () => {
    const resolved = resolveCampusSites(
      [{ code: "BLOOMINGTON", name: "IU Bloomington", active: true }],
      "IU",
      "Indiana University",
    );
    expect(resolved.sites.map((s) => s.code)).toEqual(["IU", "BLOOMINGTON"]);
    expect(resolved.primarySiteCode).toBe("IU");
  });

  it("shows untagged rows in All and on the primary site only", () => {
    expect(matchesCampusSiteScope(undefined, CAMPUS_SITE_SCOPE_ALL, "IU")).toBe(true);
    expect(matchesCampusSiteScope(undefined, "IU", "IU")).toBe(true);
    expect(matchesCampusSiteScope(undefined, "IUPUI", "IU")).toBe(false);
  });

  it("shows tagged rows on All and the matching campus", () => {
    expect(matchesCampusSiteScope("IUPUI", CAMPUS_SITE_SCOPE_ALL, "IU")).toBe(true);
    expect(matchesCampusSiteScope("IUPUI", "IUPUI", "IU")).toBe(true);
    expect(matchesCampusSiteScope("IUPUI", "BLOOMINGTON", "IU")).toBe(false);
  });

  it("rejects duplicate campus codes on put", () => {
    const parsed = campusSitesPutSchema.safeParse({
      sites: [
        { code: "IUB", name: "Bloomington" },
        { code: "IUB", name: "Duplicate" },
      ],
    });
    expect(parsed.success).toBe(false);
  });
});
