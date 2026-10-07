import type { ComplianceKeyword } from "./types.js";
import { SMS_HELP_MESSAGE } from "./sms-copy.js";

const STOP_KEYWORDS = new Set(["STOP", "STOPALL", "UNSUBSCRIBE", "END", "QUIT"]);
const START_KEYWORDS = new Set(["START", "UNSTOP", "SUBSCRIBE"]);
/** TCPA HELP only — INFO/MENU/? are orientation openers that get the SMS welcome. */
const HELP_KEYWORDS = new Set(["HELP", "COMMANDS", "AYUDA", "AIDE", "HILFE"]);

/** Neutral first texts that need the full SMS welcome (not Lex). */
export const NEUTRAL_OPENERS = new Set([
  "HI",
  "HELLO",
  "HEY",
  "START",
  "311",
  "?",
  "INFO",
  "INFORMATION",
  "WHAT",
  "HOLA",
  "BUENOS DIAS",
  "BUENAS TARDES",
  "BUENAS NOCHES",
  "XIN CHAO",
]);

export const SMS_COMPLIANCE_FOOTER =
  "Msg & data rates may apply. Reply STOP to unsubscribe · HELP for options.";

/**
 * True when the inbound text is an orientation opener with no report content.
 * Also treats very short bodies (&lt; 3 chars) as openers.
 */
export function isNeutralOpener(messageBody: string): boolean {
  const normalized = messageBody.trim().toUpperCase();
  if (!normalized) return true;
  if (NEUTRAL_OPENERS.has(normalized)) return true;
  return normalized.length < 3;
}

/** Must never be served from the agency keyword table — compliance owns these. */
export const RESERVED_COMPLIANCE_KEYWORDS = new Set([
  "HELP",
  "STOP",
  "START",
  "CANCEL",
  "QUIT",
  "UNSTOP",
  "STOPALL",
  "UNSUBSCRIBE",
  "END",
  "YES",
  "SUBSCRIBE",
]);

/** TCPA/10DLC keywords. "YES" is never START — callers use it to confirm a report. */
export function classifyKeyword(messageBody: string): ComplianceKeyword {
  const normalized = messageBody.trim().toUpperCase();
  if (STOP_KEYWORDS.has(normalized)) return "STOP";
  if (START_KEYWORDS.has(normalized)) return "START";
  if (HELP_KEYWORDS.has(normalized)) return "HELP";
  return "NONE";
}

export function isSessionResetRequest(messageBody: string): boolean {
  const normalized = messageBody.trim().toUpperCase();
  return (
    normalized === "CANCEL" ||
    normalized === "START OVER" ||
    normalized === "RESTART" ||
    normalized === "NEW" ||
    normalized === "RESET" ||
    normalized === "EMPEZAR DE NUEVO" ||
    normalized === "COMENZAR DE NUEVO" ||
    normalized === "REINICIAR"
  );
}

export const COMPLIANCE_MESSAGES: Record<Exclude<ComplianceKeyword, "NONE">, string> = {
  STOP:
    "You have been unsubscribed from this non-emergency SMS line. " +
    "You will not receive further messages. Reply START to re-subscribe. For emergencies call 911.",
  START:
    "You are now subscribed to this non-emergency SMS line. " +
    "Text your concern anytime. Reply STOP to unsubscribe. Reply HELP for options.",
  HELP: SMS_HELP_MESSAGE,
};

export const SESSION_RESET_MESSAGE =
  "No problem — starting over. What non-emergency issue can I help you report today?";

/** Format +18165550100 → (816) 555-0100 for SMS intro copy. */
export function formatPhoneNational(e164: string | null | undefined): string | null {
  const digits = (e164 ?? "").replace(/\D/g, "");
  const ten =
    digits.length === 11 && digits.startsWith("1")
      ? digits.slice(1)
      : digits.length === 10
        ? digits
        : "";
  if (!ten) return null;
  return `(${ten.slice(0, 3)}) ${ten.slice(3, 6)}-${ten.slice(6)}`;
}

export function buildWelcomeMessage(opts: {
  agencyDisplayName: string;
  voiceDidE164?: string | null;
}): string {
  const agency = opts.agencyDisplayName.trim() || "City";
  const voice = formatPhoneNational(opts.voiceDidE164);
  const callLine = voice
    ? ` Prefer to speak with someone? Call ${voice}.`
    : "";
  return (
    `${agency} Non-Emergency\n` +
    `Tell us what's happening and we'll help get your concern to the right place.${callLine}\n` +
    `Be as descriptive as possible — include the location, what you're seeing, and how long it's been going on. Include a callback number if you'd like a follow-up on your request.\n` +
    `Example: "There's a large pothole on Oak Street near the school. It's been there about a week. Call me back at 555-0123."\n` +
    `If anyone is in immediate danger or needs emergency assistance, call 9-1-1 now.\n` +
    `Msg & data rates may apply. Message frequency varies. Reply STOP to unsubscribe · HELP for options.`
  );
}

export const SESSION_TIMEOUT_MESSAGE =
  "Your previous session timed out. What non-emergency issue can I help you report today?";

export const OPTED_OUT_MESSAGE =
  "You are currently unsubscribed from this SMS line. Reply START to re-subscribe.";
