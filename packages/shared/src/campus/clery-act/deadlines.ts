/**
 * Daily Crime Log deadline: within 2 federal business days of
 * `reportedToInstitutionAt` (not RC createdAt). Weekends and observed
 * U.S. federal holidays do not count.
 */

function utcYmd(d: Date): { y: number; m: number; day: number } {
  return { y: d.getUTCFullYear(), m: d.getUTCMonth(), day: d.getUTCDate() };
}

function utcDate(y: number, m: number, day: number): Date {
  return new Date(Date.UTC(y, m, day, 0, 0, 0, 0));
}

function addUtcDays(d: Date, n: number): Date {
  const { y, m, day } = utcYmd(d);
  return utcDate(y, m, day + n);
}

function weekdayUtc(d: Date): number {
  return d.getUTCDay();
}

/** Shift Saturday→Friday, Sunday→Monday (federal observed-holiday rule). */
function observedFederal(d: Date): Date {
  const wd = weekdayUtc(d);
  if (wd === 6) return addUtcDays(d, -1);
  if (wd === 0) return addUtcDays(d, 1);
  return d;
}

function nthWeekday(year: number, month: number, weekday: number, n: number): Date {
  const first = utcDate(year, month, 1);
  const offset = (weekday - weekdayUtc(first) + 7) % 7;
  return utcDate(year, month, 1 + offset + (n - 1) * 7);
}

function lastWeekday(year: number, month: number, weekday: number): Date {
  const last = utcDate(year, month + 1, 0);
  const diff = (weekdayUtc(last) - weekday + 7) % 7;
  return utcDate(year, month, last.getUTCDate() - diff);
}

function thanksgiving(year: number): Date {
  return nthWeekday(year, 10, 4, 4);
}

function federalHolidaySet(year: number): Set<string> {
  const dates: Date[] = [
    observedFederal(utcDate(year, 0, 1)),
    nthWeekday(year, 0, 1, 3),
    nthWeekday(year, 1, 1, 3),
    lastWeekday(year, 4, 1),
    observedFederal(utcDate(year, 5, 19)),
    observedFederal(utcDate(year, 6, 4)),
    nthWeekday(year, 8, 1, 1),
    nthWeekday(year, 9, 1, 2),
    observedFederal(utcDate(year, 10, 11)),
    thanksgiving(year),
    observedFederal(utcDate(year, 11, 25)),
  ];
  const keys = new Set<string>();
  for (const d of dates) keys.add(d.toISOString().slice(0, 10));
  return keys;
}

const holidayCache = new Map<number, Set<string>>();

function holidaysForYear(year: number): Set<string> {
  let set = holidayCache.get(year);
  if (!set) {
    set = federalHolidaySet(year);
    holidayCache.set(year, set);
  }
  return set;
}

export function isFederalHolidayUtc(d: Date): boolean {
  return holidaysForYear(d.getUTCFullYear()).has(d.toISOString().slice(0, 10));
}

export function isFederalBusinessDayUtc(d: Date): boolean {
  const wd = weekdayUtc(d);
  if (wd === 0 || wd === 6) return false;
  return !isFederalHolidayUtc(d);
}

export function addFederalBusinessDaysUtc(start: Date, businessDays: number): Date {
  if (businessDays <= 0) return utcDate(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate());
  let cursor = utcDate(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate());
  let remaining = businessDays;
  while (remaining > 0) {
    cursor = addUtcDays(cursor, 1);
    if (isFederalBusinessDayUtc(cursor)) remaining -= 1;
  }
  return cursor;
}

/**
 * Deadline is the end of the 2nd federal business day after the report date
 * (receipt day itself does not count toward the two days).
 */
export function calculateDCLDeadline(reportedToInstitutionAt: Date): Date {
  const deadlineDay = addFederalBusinessDaysUtc(reportedToInstitutionAt, 2);
  return new Date(
    Date.UTC(
      deadlineDay.getUTCFullYear(),
      deadlineDay.getUTCMonth(),
      deadlineDay.getUTCDate(),
      23,
      59,
      59,
      999,
    ),
  );
}

export function isDclOverdue(reportedToInstitutionAt: Date, inDailyCrimeLog: boolean, now = new Date()): boolean {
  if (inDailyCrimeLog) return false;
  return now.getTime() > calculateDCLDeadline(reportedToInstitutionAt).getTime();
}

export function asrPublishDeadlineIso(reportYear: number): string {
  return new Date(Date.UTC(reportYear, 9, 1, 23, 59, 59, 999)).toISOString();
}

export function coverageYearsForAsr(reportYear: number): [number, number, number] {
  return [reportYear - 3, reportYear - 2, reportYear - 1];
}
