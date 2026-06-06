import { describe, expect, it } from "vitest";
import { buildAgencySlug, resolveUniqueAgencySlug } from "./agency-slug.js";

describe("buildAgencySlug", () => {
  it("ga-columbus-muscogee911", () => {
    expect(buildAgencySlug({ state: "Georgia", city: "Columbus", centerName: "Muscogee County 911" }).slug)
      .toBe("ga-columbus-muscogee911");
  });

  it("accepts state abbreviation", () => {
    expect(buildAgencySlug({ state: "GA", city: "Columbus", centerName: "Muscogee County 911" }).slug)
      .toBe("ga-columbus-muscogee911");
  });

  it("oh-columbus-franklincomm", () => {
    expect(buildAgencySlug({ state: "Ohio", city: "Columbus", centerName: "Franklin County Communications" }).slug)
      .toBe("oh-columbus-franklincountycomm");
  });

  it("strips apostrophes and special chars", () => {
    expect(buildAgencySlug({ state: "TX", city: "O'Brien", centerName: "O'Brien Co. 911" }).slug)
      .toBe("tx-obrien-obrien911");
  });

  it("replaces & with and", () => {
    expect(buildAgencySlug({ state: "FL", city: "Miami", centerName: "Fire & Rescue" }).slug)
      .toBe("fl-miami-fireandrescue");
  });

  it("truncates center segment when too long", () => {
    const result = buildAgencySlug({
      state: "CA",
      city: "Sacramento",
      centerName: "Sacramento County Sheriff Department Emergency Communications Division",
    });
    expect(result.slug.length).toBeLessThanOrEqual(60);
  });
});

describe("resolveUniqueAgencySlug", () => {
  it("returns base slug when no collision", () => {
    expect(resolveUniqueAgencySlug(
      { state: "GA", city: "Columbus", centerName: "Muscogee County 911" },
      new Set(),
    )).toBe("ga-columbus-muscogee911");
  });

  it("appends 2 on first collision", () => {
    expect(resolveUniqueAgencySlug(
      { state: "GA", city: "Columbus", centerName: "Muscogee County 911" },
      new Set(["ga-columbus-muscogee911"]),
    )).toBe("ga-columbus-muscogee9112");
  });

  it("appends 3 on second collision", () => {
    expect(resolveUniqueAgencySlug(
      { state: "GA", city: "Columbus", centerName: "Muscogee County 911" },
      new Set(["ga-columbus-muscogee911", "ga-columbus-muscogee9112"]),
    )).toBe("ga-columbus-muscogee9113");
  });
});
