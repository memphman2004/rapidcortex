import { describe, expect, it } from "vitest";
import {
  parseCampusInstitutionType,
  resolveCampusInstitutionType,
  isCampusInstitutionType,
} from "./institution-type.js";

describe("parseCampusInstitutionType", () => {
  it("returns k12 only for explicit k12", () => {
    expect(parseCampusInstitutionType("k12")).toBe("k12");
    expect(parseCampusInstitutionType("higher_ed")).toBe("higher_ed");
    expect(parseCampusInstitutionType(undefined)).toBe("higher_ed");
    expect(parseCampusInstitutionType(null)).toBe("higher_ed");
    expect(parseCampusInstitutionType("university")).toBe("higher_ed");
  });
});

describe("resolveCampusInstitutionType", () => {
  it("prefers institutionType over campusType", () => {
    expect(
      resolveCampusInstitutionType({ institutionType: "higher_ed", campusType: "k12" }),
    ).toBe("higher_ed");
    expect(resolveCampusInstitutionType({ campusType: "k12" })).toBe("k12");
  });

  it("defaults legacy agencies to higher_ed", () => {
    expect(resolveCampusInstitutionType({})).toBe("higher_ed");
  });
});

describe("isCampusInstitutionType", () => {
  it("narrows known values", () => {
    expect(isCampusInstitutionType("k12")).toBe(true);
    expect(isCampusInstitutionType("higher_ed")).toBe(true);
    expect(isCampusInstitutionType("university")).toBe(false);
  });
});
