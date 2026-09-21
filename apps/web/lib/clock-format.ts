export type ClockFormat = "12" | "24";

export const DEFAULT_CLOCK_FORMAT: ClockFormat = "12";

export function isClockFormat(value: string): value is ClockFormat {
  return value === "12" || value === "24";
}

export function hour12FromClockFormat(format: ClockFormat): boolean {
  return format === "12";
}

export function localeTimeOptions(
  hour12: boolean,
  extra: Intl.DateTimeFormatOptions = {},
): Intl.DateTimeFormatOptions {
  return {
    hour: hour12 ? "numeric" : "2-digit",
    minute: "2-digit",
    hour12,
    ...extra,
  };
}

export function formatClockTime(
  value: Date | string,
  hour12: boolean,
  extra: Intl.DateTimeFormatOptions = {},
  locale?: string,
): string {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleTimeString(locale, localeTimeOptions(hour12, extra));
}

export function formatHeaderClock(
  now: Date,
  hour12: boolean,
  locale?: string,
): { dateLine: string; timeMain: string; ampm: string } {
  const dateLine = now.toLocaleDateString(locale, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  const timeParts = now.toLocaleTimeString(locale, localeTimeOptions(hour12));
  if (!hour12) {
    return { dateLine, timeMain: timeParts, ampm: "" };
  }
  const match = timeParts.match(/^(.+)\s+(AM|PM)$/i);
  return {
    dateLine,
    timeMain: match?.[1] ?? timeParts,
    ampm: match?.[2] ?? "",
  };
}

let activeClockHour12 = hour12FromClockFormat(DEFAULT_CLOCK_FORMAT);

export function getActiveClockHour12(): boolean {
  return activeClockHour12;
}

export function setActiveClockHour12(hour12: boolean): void {
  activeClockHour12 = hour12;
}
