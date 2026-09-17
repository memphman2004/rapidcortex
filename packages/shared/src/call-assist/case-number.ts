/** Display case numbers for Call Assist sessions (not the internal `cas_` session id). */

const DEFAULT_TZ = "UTC";
const KCPD_TZ = "America/Chicago";

export function callAssistCasePrefix(agencyId: string): string {
  const id = String(agencyId ?? "")
    .trim()
    .toLowerCase();
  if (id === "kcpd") return "KCNE";
  const alnum = id.replace(/[^a-z0-9]/g, "").slice(0, 4).toUpperCase();
  return `${alnum || "RC"}NE`;
}

export function callAssistCaseTimeZone(agencyId: string, configured?: string | null): string {
  const tz = configured?.trim();
  if (tz) return tz;
  return String(agencyId ?? "").trim().toLowerCase() === "kcpd" ? KCPD_TZ : DEFAULT_TZ;
}

function pad12(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.length >= 12) return digits.slice(-12);
  return digits.padStart(12, "0");
}

/** 12-digit serial. Prefer passing a crypto-backed value from the API. */
export function callAssistCaseSerial(seed?: string): string {
  if (seed) return pad12(seed);
  const n = Math.floor(Math.random() * 1e12);
  return String(n).padStart(12, "0");
}

/**
 * KCNE-{mm/dd/yyyy}-{HH:mm:ss}-{12-digit case#}
 */
export function formatCallAssistCaseNumber(opts: {
  agencyId: string;
  at?: Date;
  timeZone?: string | null;
  serial?: string;
}): string {
  const at = opts.at ?? new Date();
  const timeZone = callAssistCaseTimeZone(opts.agencyId, opts.timeZone);
  let date = "01/01/1970";
  let time = "00:00:00";
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      month: "2-digit",
      day: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }).formatToParts(at);
    const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? "00";
    const hour = get("hour") === "24" ? "00" : get("hour");
    date = `${get("month")}/${get("day")}/${get("year")}`;
    time = `${hour}:${get("minute")}:${get("second")}`;
  } catch {
    const mm = String(at.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(at.getUTCDate()).padStart(2, "0");
    date = `${mm}/${dd}/${at.getUTCFullYear()}`;
    time = `${String(at.getUTCHours()).padStart(2, "0")}:${String(at.getUTCMinutes()).padStart(2, "0")}:${String(at.getUTCSeconds()).padStart(2, "0")}`;
  }
  return `${callAssistCasePrefix(opts.agencyId)}-${date}-${time}-${callAssistCaseSerial(opts.serial)}`;
}
