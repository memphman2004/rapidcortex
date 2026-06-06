import {
  DAYS_OF_WEEK,
  type DayOfWeek,
  type ShiftSchedule,
  type TimeWindow,
} from "./access-policy-types.js";

const DAY_INDEX: Record<DayOfWeek, number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
};

function dayOfWeekFromDate(date: Date, timeZone: string): DayOfWeek {
  const weekday = new Intl.DateTimeFormat("en-US", { timeZone, weekday: "long" })
    .format(date)
    .toLowerCase();
  return DAYS_OF_WEEK.find((d) => d === weekday) ?? "monday";
}

function minutesInTz(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "numeric",
    minute: "numeric",
    hour12: false,
  }).formatToParts(date);
  const hour = Number.parseInt(parts.find((p) => p.type === "hour")?.value ?? "0", 10);
  const minute = Number.parseInt(parts.find((p) => p.type === "minute")?.value ?? "0", 10);
  return hour * 60 + minute;
}

function windowToRange(w: TimeWindow): { start: number; end: number } {
  const start = w.startHour * 60 + w.startMinute;
  const end = w.endHour * 60 + w.endMinute;
  return { start, end };
}

function isWithinWindow(nowMinutes: number, w: TimeWindow): boolean {
  const { start, end } = windowToRange(w);
  if (start === end) return false;
  if (start < end) {
    return nowMinutes >= start && nowMinutes < end;
  }
  return false;
}

export function isWithinAccessWindow(schedule: ShiftSchedule, now: Date = new Date()): boolean {
  const day = dayOfWeekFromDate(now, schedule.timezone);
  const daily = schedule.schedule[day];
  if (!daily?.enabled || daily.windows.length === 0) return false;
  const nowMinutes = minutesInTz(now, schedule.timezone);
  return daily.windows.some((w) => isWithinWindow(nowMinutes, w));
}

export function nextAccessWindowOpens(schedule: ShiftSchedule, now: Date = new Date()): string | null {
  const maxIterations = 7 * 24 * 4;
  let probe = new Date(now.getTime());
  for (let i = 0; i < maxIterations; i++) {
    const day = dayOfWeekFromDate(probe, schedule.timezone);
    const daily = schedule.schedule[day];
    if (daily?.enabled && daily.windows.length > 0) {
      const nowMinutes = minutesInTz(probe, schedule.timezone);
      for (const w of daily.windows) {
        const { start } = windowToRange(w);
        if (start > nowMinutes || i > 0) {
          const [h, m] = [Math.floor(start / 60), start % 60];
          const dateParts = new Intl.DateTimeFormat("en-CA", {
            timeZone: schedule.timezone,
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
          }).format(probe);
          const isoLocal = `${dateParts}T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00`;
          const asUtc = new Date(
            new Date(isoLocal).toLocaleString("en-US", { timeZone: schedule.timezone }),
          );
          if (!Number.isNaN(asUtc.getTime())) return asUtc.toISOString();
          return new Date(probe.getTime() + (start - nowMinutes) * 60_000).toISOString();
        }
      }
    }
    probe = new Date(probe.getTime() + 86_400_000);
  }
  return null;
}

export function validateShiftSchedule(schedule: ShiftSchedule): string[] {
  const errors: string[] = [];
  try {
    Intl.DateTimeFormat(undefined, { timeZone: schedule.timezone });
  } catch {
    errors.push(`Invalid timezone: ${schedule.timezone}`);
  }
  for (const day of DAYS_OF_WEEK) {
    const daily = schedule.schedule[day];
    if (!daily) {
      errors.push(`Missing schedule for ${day}`);
      continue;
    }
    if (!daily.enabled) continue;
    for (const w of daily.windows) {
      const { start, end } = windowToRange(w);
      if (start >= end) {
        errors.push(
          `${day}: window must not span midnight (use two windows); start must be before end`,
        );
      }
      if (
        w.startHour < 0 ||
        w.startHour > 23 ||
        w.endHour < 0 ||
        w.endHour > 23 ||
        w.startMinute < 0 ||
        w.startMinute > 59 ||
        w.endMinute < 0 ||
        w.endMinute > 59
      ) {
        errors.push(`${day}: invalid hour/minute in window`);
      }
    }
    for (let i = 0; i < daily.windows.length; i++) {
      for (let j = i + 1; j < daily.windows.length; j++) {
        const a = windowToRange(daily.windows[i]!);
        const b = windowToRange(daily.windows[j]!);
        if (a.start < b.end && b.start < a.end) {
          errors.push(`${day}: overlapping windows`);
        }
      }
    }
  }
  return errors;
}

export function hasEnabledScheduleDay(schedule: ShiftSchedule): boolean {
  return DAYS_OF_WEEK.some((day) => {
    const d = schedule.schedule[day];
    return Boolean(d?.enabled && d.windows.length > 0);
  });
}
