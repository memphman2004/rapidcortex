import { describe, expect, it } from "vitest";
import {
  addFederalBusinessDaysUtc,
  calculateDCLDeadline,
  isDclOverdue,
  isFederalBusinessDayUtc,
  isFederalHolidayUtc,
} from "./deadlines.js";

describe("CleryDeadlineService (federal business days)", () => {
  it("does not count Saturday or Sunday", () => {
    expect(isFederalBusinessDayUtc(new Date("2026-09-05T12:00:00.000Z"))).toBe(false);
    expect(isFederalBusinessDayUtc(new Date("2026-09-06T12:00:00.000Z"))).toBe(false);
    expect(isFederalBusinessDayUtc(new Date("2026-09-08T12:00:00.000Z"))).toBe(true);
  });

  it("treats Independence Day as a federal holiday (observed)", () => {
    expect(isFederalHolidayUtc(new Date("2026-07-03T12:00:00.000Z"))).toBe(true);
  });

  it("starts the Daily Crime Log clock from reportedToInstitutionAt, not system createdAt", () => {
    const reportedFriday = new Date("2026-03-06T16:22:00.000Z");
    const createdLater = new Date("2026-03-11T09:00:00.000Z");
    const deadline = calculateDCLDeadline(reportedFriday);
    expect(deadline.toISOString().slice(0, 10)).toBe("2026-03-10");
    expect(deadline.getTime()).toBeLessThan(createdLater.getTime());
  });

  it("adds two business days mid-week", () => {
    const monday = new Date("2026-09-08T09:00:00.000Z");
    const deadline = calculateDCLDeadline(monday);
    expect(deadline.toISOString().slice(0, 10)).toBe("2026-09-10");
  });

  it("marks overdue only when the DCL is not yet entered", () => {
    const reported = new Date("2026-09-01T12:00:00.000Z");
    const now = new Date("2026-09-10T12:00:00.000Z");
    expect(isDclOverdue(reported, false, now)).toBe(true);
    expect(isDclOverdue(reported, true, now)).toBe(false);
  });

  it("skips Thanksgiving when adding business days", () => {
    const wed = new Date("2026-11-25T12:00:00.000Z");
    const plusTwo = addFederalBusinessDaysUtc(wed, 2);
    expect(plusTwo.toISOString().slice(0, 10)).toBe("2026-11-30");
  });
});
