import { describe, expect, it } from "vitest";
import {
  ALL_GRANT_PROGRAM_SUGGESTIONS,
  RETIRED_GRANT_PROGRAM_SUGGESTIONS,
  inferGrantVertical,
  normalizeLegacyGrantProgramName,
  suggestGrantPrograms,
} from "./grant-program-suggestions";

describe("grant-program-suggestions", () => {
  it("infers verticals from existing agency type labels", () => {
    expect(inferGrantVertical("911 / Emergency Communications Center (ECC)")).toBe("psap");
    expect(inferGrantVertical("K-12 School District / Campus Safety")).toBe("campus_k12");
    expect(inferGrantVertical("University / Campus Public Safety")).toBe("campus_higher_ed");
    expect(inferGrantVertical("Venue / Stadium Operations")).toBe("venue");
    expect(inferGrantVertical("Transit Agency Public Safety")).toBe("transit");
  });

  it("suggests national PSAP programs and excludes ARPA / retired generics", () => {
    const names = suggestGrantPrograms({
      agencyType: "911 / Emergency Communications Center (ECC)",
      agencyState: "TX",
    });
    expect(names).toContain("COPS Technology and Equipment Program (TEP)");
    expect(names).toContain("Edward Byrne Memorial Justice Assistance Grant (JAG) — Local");
    expect(names).toContain("Edward Byrne Memorial Justice Assistance Grant (JAG) — State");
    expect(names).toContain("FEMA State Homeland Security Program (SHSP)");
    expect(names).toContain("FEMA Urban Area Security Initiative (UASI)");
    expect(names).toContain(
      "Congressionally Directed Spending (CDS) / Community Project Funding (CPF)",
    );
    expect(names).not.toContain("ARPA / SLFRF");
    expect(names).not.toContain("PSAP NG911 Grant Program");
    expect(names).not.toContain("State Criminal Justice Grant");
    expect(names).not.toContain("COPS Technology Program");
    expect(names).not.toContain("FTA Urbanized Area Formula Grants — Section 5307");
  });

  it("adds verified state PSAP programs for matching states only", () => {
    const wi = suggestGrantPrograms({
      agencyType: "Combined PSAP",
      agencyState: "WI",
    });
    expect(wi).toContain("Wisconsin PSAP Grant Program");
    expect(wi).toContain("Wisconsin NG911 GIS Grant Program");

    const az = suggestGrantPrograms({
      agencyType: "911 / Emergency Communications Center (ECC)",
      agencyState: "az",
    });
    expect(az).toContain("Arizona 9-1-1 Program — Funding Assistance");
    expect(az).not.toContain("Wisconsin PSAP Grant Program");

    const ok = suggestGrantPrograms({
      agencyType: "911 / Emergency Communications Center (ECC)",
      agencyState: "OK",
    });
    expect(ok).toContain("911 ACOG Grant Program");
    // Statewide OK title intentionally omitted until verified.
    expect(ok.some((n) => /oklahoma state 911/i.test(n))).toBe(false);
  });

  it("filters transit and campus verticals", () => {
    const transit = suggestGrantPrograms({
      agencyType: "Transit Agency Public Safety",
      agencyState: "CA",
    });
    expect(transit).toContain("FTA Urbanized Area Formula Grants — Section 5307");
    expect(transit).toContain("FEMA Transit Security Grant Program (TSGP)");
    expect(transit).not.toContain("COPS School Violence Prevention Program (SVPP)");

    const k12 = suggestGrantPrograms({
      agencyType: "K-12 School District / Campus Safety",
      agencyState: "VA",
    });
    expect(k12).toContain("COPS School Violence Prevention Program (SVPP)");
    expect(k12).toContain("BJA STOP School Violence Program");
    expect(k12).not.toContain("Virginia PSAP Resiliency Grant Program");
  });

  it("returns national programs without inventing Missouri closed rounds", () => {
    const mo = suggestGrantPrograms({
      agencyType: "911 / Emergency Communications Center (ECC)",
      agencyState: "MO",
    });
    expect(mo.some((n) => /missouri 911 service board/i.test(n))).toBe(false);
    expect(mo).toContain("COPS Technology and Equipment Program (TEP)");
  });

  it("has unique catalog names and maps legacy labels", () => {
    const names = ALL_GRANT_PROGRAM_SUGGESTIONS.map((p) => p.name);
    expect(new Set(names).size).toBe(names.length);
    for (const retired of RETIRED_GRANT_PROGRAM_SUGGESTIONS) {
      expect(names).not.toContain(retired);
    }
    expect(normalizeLegacyGrantProgramName("COPS Technology Program")).toBe(
      "COPS Technology and Equipment Program (TEP)",
    );
  });
});
