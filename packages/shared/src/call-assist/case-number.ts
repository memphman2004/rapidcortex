/** Phone-friendly confirmation numbers for Call Assist (not the internal `cas_` session id). */

const CONFIRMATION_CHARSET = "ACDEFGHJKMNPQRTUVWXYZ234679";
const NATO: Record<string, string> = {
  A: "Alpha",
  C: "Charlie",
  D: "Delta",
  E: "Echo",
  F: "Foxtrot",
  G: "Golf",
  H: "Hotel",
  J: "Juliet",
  K: "Kilo",
  M: "Mike",
  N: "November",
  P: "Papa",
  Q: "Quebec",
  R: "Romeo",
  T: "Tango",
  U: "Uniform",
  V: "Victor",
  W: "Whiskey",
  X: "X-ray",
  Y: "Yankee",
  Z: "Zulu",
  "2": "two",
  "3": "three",
  "4": "four",
  "6": "six",
  "7": "seven",
  "9": "nine",
};

const DEFAULT_TZ = "UTC";
const KCPD_TZ = "America/Chicago";

/** Two-letter agency prefix for confirmation numbers (spec: KC-1001-7M4R). */
export function callAssistConfirmationPrefix(
  agencyId: string,
  configured?: string | null,
): string {
  const fromConfig = configured?.trim().toUpperCase().replace(/[^A-Z]/g, "").slice(0, 2);
  if (fromConfig && fromConfig.length === 2) return fromConfig;
  const id = String(agencyId ?? "")
    .trim()
    .toLowerCase();
  if (id === "kcpd" || id === "kc-nec" || id.includes("kansas")) return "KC";
  const alnum = id.replace(/[^a-z]/g, "").slice(0, 2).toUpperCase();
  return alnum.length === 2 ? alnum : "RC";
}

/** @deprecated Prefer {@link callAssistConfirmationPrefix} — kept for legacy KCNE-* readers. */
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

function mmdd(at: Date, timeZone: string): string {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(at);
    const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? "01";
    return `${get("month")}${get("day")}`;
  } catch {
    return `${String(at.getUTCMonth() + 1).padStart(2, "0")}${String(at.getUTCDate()).padStart(2, "0")}`;
  }
}

function randomSuffix(length = 4, rng: () => number = Math.random): string {
  let out = "";
  for (let i = 0; i < length; i += 1) {
    out += CONFIRMATION_CHARSET[Math.floor(rng() * CONFIRMATION_CHARSET.length)]!;
  }
  return out;
}

/**
 * Spec confirmation: `{2-letterPrefix}-{MMDD}-{4chars}`
 * Example: KC-1001-7M4R
 */
export function formatCallAssistCaseNumber(opts: {
  agencyId: string;
  at?: Date;
  timeZone?: string | null;
  /** Optional tenant confirmationPrefix (2 letters). */
  confirmationPrefix?: string | null;
  /** Inject for tests — 4-char suffix; otherwise random from safe charset. */
  suffix?: string;
  /** @deprecated Ignored for new format; accepted so call sites keep compiling. */
  serial?: string;
  rng?: () => number;
}): string {
  const at = opts.at ?? new Date();
  const timeZone = callAssistCaseTimeZone(opts.agencyId, opts.timeZone);
  const prefix = callAssistConfirmationPrefix(opts.agencyId, opts.confirmationPrefix);
  const datePart = mmdd(at, timeZone);
  const suffix =
    opts.suffix?.trim().toUpperCase().replace(/[^ACDEFGHJKMNPQRTUVWXYZ234679]/g, "").slice(0, 4) ||
    randomSuffix(4, opts.rng);
  const padded = suffix.padEnd(4, "A").slice(0, 4);
  return `${prefix}-${datePart}-${padded}`;
}

/** True for new PREFIX-MMDD-XXXX or legacy KCNE-… / RC-… forms. */
export function isCallAssistConfirmationNumber(value: string): boolean {
  const v = value.trim().toUpperCase();
  if (/^[A-Z]{2}-\d{4}-[ACDEFGHJKMNPQRTUVWXYZ234679]{4}$/.test(v)) return true;
  if (/^[A-Z0-9]+NE-\d{2}\/\d{2}\/\d{4}-\d{2}:\d{2}:\d{2}-\d{12}$/.test(v)) return true;
  if (/^RC-[A-Z0-9]+$/i.test(v)) return true;
  return false;
}

/**
 * Spoken form for Polly: "KC, one zero zero one, seven Mike four Romeo"
 */
export function formatConfirmationForSpeech(confirmationNumber: string): string {
  const parts = confirmationNumber.trim().toUpperCase().split("-");
  if (parts.length < 3) return confirmationNumber;
  const [prefix, datePart, suffix] = parts;
  const speakChar = (ch: string): string => {
    if (/^\d$/.test(ch)) {
      const words = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine"];
      return words[Number(ch)] ?? ch;
    }
    return NATO[ch] ?? ch;
  };
  const prefixSpoken = (prefix ?? "").split("").join(", ");
  const dateSpoken = (datePart ?? "").split("").map(speakChar).join(" ");
  const suffixSpoken = (suffix ?? "")
    .split("")
    .map((ch) => speakChar(ch))
    .join(" ");
  return `${prefixSpoken}, ${dateSpoken}, ${suffixSpoken}`;
}

/** @deprecated Prefer formatCallAssistCaseNumber without serial. */
export function callAssistCaseSerial(seed?: string): string {
  const digits = (seed ?? "").replace(/\D/g, "");
  if (digits.length >= 12) return digits.slice(-12);
  if (digits) return digits.padStart(12, "0");
  return String(Math.floor(Math.random() * 1e12)).padStart(12, "0");
}

export const CALL_ASSIST_CONFIRMATION_CHARSET = CONFIRMATION_CHARSET;
