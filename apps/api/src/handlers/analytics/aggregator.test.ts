import { describe, expect, it } from "vitest";
import {
  analyticsDailyKeys,
  deriveVerticalFromSource,
  parseBackfillDays,
  utcDateString,
  verticalFromAgencyType,
} from "./aggregator";

describe("analytics aggregator helpers", () => {
  it("parses backfill window and UTC date offsets", () => {
    expect(parseBackfillDays({ backfillDays: 1 })).toBe(1);
    expect(parseBackfillDays({})).toBe(7);
    expect(parseBackfillDays({ backfillDays: 99 })).toBe(30);
    expect(utcDateString(new Date("2026-10-03T12:00:00.000Z"), 0)).toBe("2026-10-03");
    expect(utcDateString(new Date("2026-10-03T12:00:00.000Z"), -1)).toBe("2026-10-02");
  });

  it("builds agency/vertical/date keys", () => {
    expect(analyticsDailyKeys("psap-1", "911", "2026-10-02")).toEqual({
      pk: "AGENCY#psap-1#VERTICAL#911",
      sk: "DATE#2026-10-02",
    });
  });

  it("derives vertical from stream source arn", () => {
    expect(deriveVerticalFromSource("arn:aws:dynamodb:...:table/rapid-cortex-campus-incidents-dev")).toBe("campus");
    expect(deriveVerticalFromSource("arn:aws:dynamodb:...:table/rapid-cortex-incidents-dev")).toBe("911");
  });

  it("maps agency type to vertical", () => {
    expect(verticalFromAgencyType("venue")).toBe("venue");
    expect(verticalFromAgencyType("city")).toBe("911");
  });
});
