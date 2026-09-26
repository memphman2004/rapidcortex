import { formatClockTime, getActiveClockHour12 } from "./clock-format";

export function formatTime(iso: string, hour12: boolean = getActiveClockHour12()): string {
  try {
    return formatClockTime(iso, hour12, { second: "2-digit" });
  } catch {
    return "—";
  }
}

export function formatRelativeOpened(iso: string): string {
  try {
    const opened = new Date(iso).getTime();
    if (!Number.isFinite(opened)) return "—";
    const sec = Math.max(0, Math.floor((Date.now() - opened) / 1000));
    if (sec < 60) return `${sec}s ago`;
    const min = Math.floor(sec / 60);
    if (min < 60) return `${min}m ago`;
    const hr = Math.floor(min / 60);
    if (hr < 48) return `${hr}h ago`;
    const days = Math.floor(hr / 24);
    return `${days}d ago`;
  } catch {
    return "—";
  }
}
