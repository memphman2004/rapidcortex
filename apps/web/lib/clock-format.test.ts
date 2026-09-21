import { afterEach, describe, expect, it } from "vitest";
import {
  DEFAULT_CLOCK_FORMAT,
  formatClockTime,
  formatHeaderClock,
  getActiveClockHour12,
  hour12FromClockFormat,
  isClockFormat,
  setActiveClockHour12,
} from "./clock-format.js";

describe("clock-format", () => {
  afterEach(() => {
    setActiveClockHour12(hour12FromClockFormat(DEFAULT_CLOCK_FORMAT));
  });

  it("accepts only 12 and 24", () => {
    expect(isClockFormat("12")).toBe(true);
    expect(isClockFormat("24")).toBe(true);
    expect(isClockFormat("36")).toBe(false);
  });

  it("formats 12-hour times with AM/PM in en-US", () => {
    const afternoon = new Date(2026, 3, 20, 15, 30, 0);
    const s = formatClockTime(afternoon, true, {}, "en-US");
    expect(s).toMatch(/3:30/);
    expect(s).toMatch(/PM/i);
  });

  it("formats 24-hour times without AM/PM in en-US", () => {
    const afternoon = new Date(2026, 3, 20, 15, 30, 0);
    const s = formatClockTime(afternoon, false, {}, "en-US");
    expect(s).toMatch(/15:30/);
    expect(s).not.toMatch(/AM|PM/i);
  });

  it("returns an em dash for invalid input", () => {
    expect(formatClockTime("not-a-date", true)).toBe("—");
  });

  it("splits header clock AM/PM in 12-hour mode", () => {
    const morning = new Date(2026, 3, 20, 9, 5, 0);
    const clock = formatHeaderClock(morning, true, "en-US");
    expect(clock.timeMain).toMatch(/9:05/);
    expect(clock.ampm).toMatch(/AM/i);
    expect(clock.dateLine).toMatch(/April/);
  });

  it("omits AM/PM on the header clock in 24-hour mode", () => {
    const afternoon = new Date(2026, 3, 20, 15, 30, 0);
    const clock = formatHeaderClock(afternoon, false, "en-US");
    expect(clock.timeMain).toMatch(/15:30/);
    expect(clock.ampm).toBe("");
  });

  it("tracks the active hour12 flag for non-hook formatters", () => {
    expect(getActiveClockHour12()).toBe(true);
    setActiveClockHour12(false);
    expect(getActiveClockHour12()).toBe(false);
  });
});
