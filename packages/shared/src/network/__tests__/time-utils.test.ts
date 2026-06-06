import { describe, expect, it } from "vitest";
import type { ShiftSchedule } from "../access-policy-types.js";
import {
  hasEnabledScheduleDay,
  isWithinAccessWindow,
  validateShiftSchedule,
} from "../time-utils.js";

function scheduleMonFriNineToFive(): ShiftSchedule {
  const window = { startHour: 9, startMinute: 0, endHour: 17, endMinute: 0 };
  const enabled = { enabled: true, windows: [window] };
  const disabled = { enabled: false, windows: [] };
  return {
    timezone: "America/New_York",
    schedule: {
      monday: enabled,
      tuesday: enabled,
      wednesday: enabled,
      thursday: enabled,
      friday: enabled,
      saturday: disabled,
      sunday: disabled,
    },
  };
}

describe("time-utils", () => {
  it("rejects overnight-spanning single window", () => {
    const schedule: ShiftSchedule = {
      timezone: "America/Chicago",
      schedule: {
        monday: {
          enabled: true,
          windows: [{ startHour: 22, startMinute: 0, endHour: 6, endMinute: 0 }],
        },
        tuesday: { enabled: false, windows: [] },
        wednesday: { enabled: false, windows: [] },
        thursday: { enabled: false, windows: [] },
        friday: { enabled: false, windows: [] },
        saturday: { enabled: false, windows: [] },
        sunday: { enabled: false, windows: [] },
      },
    };
    expect(validateShiftSchedule(schedule).length).toBeGreaterThan(0);
  });

  it("hasEnabledScheduleDay detects configured days", () => {
    expect(hasEnabledScheduleDay(scheduleMonFriNineToFive())).toBe(true);
  });

  it("isWithinAccessWindow respects timezone weekday", () => {
    const schedule = scheduleMonFriNineToFive();
    const mondayNoonUtc = new Date("2026-05-18T16:00:00.000Z");
    expect(isWithinAccessWindow(schedule, mondayNoonUtc)).toBe(true);
  });

  it("blocks when all days disabled", () => {
    const schedule: ShiftSchedule = {
      timezone: "America/New_York",
      schedule: {
        monday: { enabled: false, windows: [] },
        tuesday: { enabled: false, windows: [] },
        wednesday: { enabled: false, windows: [] },
        thursday: { enabled: false, windows: [] },
        friday: { enabled: false, windows: [] },
        saturday: { enabled: false, windows: [] },
        sunday: { enabled: false, windows: [] },
      },
    };
    expect(isWithinAccessWindow(schedule)).toBe(false);
  });
});
