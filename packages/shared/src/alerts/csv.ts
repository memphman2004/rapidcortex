import { toE164 } from "../lib/phone-format.js";
import { alertOptInMethodSchema, type AlertOptInMethod } from "./schemas.js";

export type AlertCsvRowError = {
  row: number;
  message: string;
};

export type ParsedAlertRecipientRow = {
  email?: string;
  phoneE164?: string;
  displayName?: string;
  groupSlugs: string[];
  smsOptIn: boolean;
  optInDate?: string;
  optInMethod?: AlertOptInMethod;
  optInConsentText?: string;
};

const HEADER_ALIASES: Record<string, string> = {
  email: "email",
  phone: "phone",
  phone_e164: "phone",
  mobile: "phone",
  first_name: "first_name",
  last_name: "last_name",
  name: "name",
  groups: "groups",
  group: "groups",
  opt_in_date: "opt_in_date",
  opt_in_method: "opt_in_method",
  opt_in_consent_text: "opt_in_consent_text",
};

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (ch === "," && !inQuotes) {
      out.push(cur.trim());
      cur = "";
      continue;
    }
    cur += ch;
  }
  out.push(cur.trim());
  return out;
}

function headerKey(raw: string): string {
  return HEADER_ALIASES[raw.trim().toLowerCase().replace(/\s+/g, "_")] ?? raw.trim().toLowerCase();
}

/**
 * Parse occupant CSV. Phone rows require opt_in_date + opt_in_method + opt_in_consent_text.
 * Row failures do not abort the job.
 */
export function parseAlertRecipientCsv(csv: string): {
  rows: ParsedAlertRecipientRow[];
  errors: AlertCsvRowError[];
} {
  const lines = csv.replace(/^\uFEFF/, "").split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) {
    return { rows: [], errors: [{ row: 0, message: "CSV must include a header row and at least one data row" }] };
  }
  const headers = splitCsvLine(lines[0]!).map(headerKey);
  const idx = (name: string) => headers.indexOf(name);

  const rows: ParsedAlertRecipientRow[] = [];
  const errors: AlertCsvRowError[] = [];

  for (let i = 1; i < lines.length; i += 1) {
    const cols = splitCsvLine(lines[i]!);
    const get = (name: string) => {
      const n = idx(name);
      return n >= 0 ? (cols[n] ?? "").trim() : "";
    };
    const emailRaw = get("email").toLowerCase();
    const phoneRaw = get("phone");
    const first = get("first_name");
    const last = get("last_name");
    const name = get("name");
    const groupsRaw = get("groups");
    const optInDate = get("opt_in_date");
    const optInMethodRaw = get("opt_in_method");
    const optInConsentText = get("opt_in_consent_text");

    const email = emailRaw && emailRaw.includes("@") ? emailRaw : undefined;
    const phoneE164 = phoneRaw ? toE164(phoneRaw) ?? undefined : undefined;
    if (phoneRaw && !phoneE164) {
      errors.push({ row: i + 1, message: "Phone is not a valid US number" });
      continue;
    }
    if (!email && !phoneE164) {
      errors.push({ row: i + 1, message: "Row needs an email or a phone number" });
      continue;
    }

    let smsOptIn = false;
    let optInMethod: AlertOptInMethod | undefined;
    if (phoneE164) {
      const methodParsed = alertOptInMethodSchema.safeParse(optInMethodRaw.trim().toLowerCase());
      if (!optInDate || !methodParsed.success || !optInConsentText) {
        errors.push({
          row: i + 1,
          message: "Phone rows require opt_in_date, opt_in_method, and opt_in_consent_text (TCPA)",
        });
        continue;
      }
      smsOptIn = true;
      optInMethod = methodParsed.data;
    }

    const displayName = name || [first, last].filter(Boolean).join(" ").trim() || undefined;
    const groupSlugs = groupsRaw
      .split(/[;,]/)
      .map((s) => s.trim())
      .filter(Boolean);

    rows.push({
      email,
      phoneE164,
      displayName,
      groupSlugs,
      smsOptIn,
      optInDate: phoneE164 ? optInDate : undefined,
      optInMethod,
      optInConsentText: phoneE164 ? optInConsentText : undefined,
    });
  }

  return { rows, errors };
}

export function recipientEligibleForSms(input: {
  phoneE164?: string;
  smsOptIn: boolean;
  smsOptedOut: boolean;
  dnc: boolean;
}): { ok: true } | { ok: false; reason: "MISSING_PHONE" | "NO_SMS_CONSENT" | "SMS_OPTED_OUT" | "DNC" } {
  if (!input.phoneE164) return { ok: false, reason: "MISSING_PHONE" };
  if (input.smsOptedOut) return { ok: false, reason: "SMS_OPTED_OUT" };
  if (input.dnc) return { ok: false, reason: "DNC" };
  if (!input.smsOptIn) return { ok: false, reason: "NO_SMS_CONSENT" };
  return { ok: true };
}
