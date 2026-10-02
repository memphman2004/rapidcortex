import { describe, expect, it } from "vitest";
import {
  academicYearBounds,
  parseCleryCsv,
  suggestCleryCategory,
} from "./campus-clery-service.js";

describe("campus-clery-service helpers", () => {
  it("parses academic year bounds as Aug 1–Jul 31 UTC", () => {
    expect(academicYearBounds("2025-2026")).toEqual({
      start: "2025-08-01T00:00:00.000Z",
      end: "2026-07-31T23:59:59.999Z",
    });
  });

  it("suggests a single keyword category and never invents multi-match", () => {
    expect(suggestCleryCategory("other", "suspected arson in stairwell")).toBe("Arson");
    expect(suggestCleryCategory("other", "arson and robbery")).toBeNull();
  });

  it("parses Clery CSV rows from other software exports", () => {
    const csv = [
      "occurredAt,category,geography,location,building,notes,externalRecordId,unfounded",
      "2025-09-01T12:00:00.000Z,Burglary,on_campus,Lobby,Hall A,Taken from desk,pd-100,false",
    ].join("\n");
    const rows = parseCleryCsv(csv);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      category: "Burglary",
      geography: "on_campus",
      externalRecordId: "pd-100",
      unfounded: false,
    });
  });
});
