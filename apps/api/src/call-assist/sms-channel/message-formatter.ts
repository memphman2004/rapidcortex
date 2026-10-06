import { isCallAssistConfirmationNumber } from "rapid-cortex-shared";

const VOICE_FILLERS = [
  /please hold while[^.!?]*/gi,
  /one moment please[^.!?]*/gi,
  /let me [a-z ]+ for you[^.!?]*/gi,
  /I am connecting you[^.!?]*/gi,
  /I will connect you[^.!?]*/gi,
  /I'm connecting you[^.!?]*/gi,
  /Having trouble with that[^.!?]*/gi,
  /connecting you to someone who can help[^.!?]*/gi,
  /please stay on the line[^.!?]*/gi,
  /you can also visit[^.!?\n]*/gi,
  // Self-referential voice tip — already on the SMS channel.
  /You can also text us at[^.!?]*/gi,
  // Voice IVR greeting — strip longest phrases first so "stay on the line" alone
  // does not leave "For all other requests, ." behind.
  /You've reached the non-emergency service line[^.!?]*(?:\.|,)?/gi,
  /If this is a life-threatening emergency,? hang up and dial 9-1-1[^.!?]*(?:\.|,)?/gi,
  /For all other requests,? stay on the line[^.!?]*(?:\.|,)?/gi,
  /For all other requests,?\s*\.?/gi,
  /hang up and dial 9-1-1[^.!?]*/gi,
  /(?:please )?stay on the line[^.!?]*/gi,
];

const SMS_FALLBACK_PROMPT =
  "What non-emergency issue can I help you report today? Reply HELP for options. For emergencies call 911.";

const SSML_TAGS = /<[^>]+>/g;
const CONFIRMATION_IN_TEXT = /\b([A-Z]{2}-\d{4}-[ACDEFGHJKMNPQRTUVWXYZ234679]{4})\b/;

/** AWS End User Messaging accepts up to 1600 chars; carriers concat as one ordered message. */
export const SMS_MAX_MESSAGE_CHARS = 1600;

export function extractConfirmationFromText(raw: string): string | undefined {
  const match = CONFIRMATION_IN_TEXT.exec(raw.toUpperCase());
  if (match?.[1] && isCallAssistConfirmationNumber(match[1])) return match[1];
  return undefined;
}

export function formatForSms(rawMessages: Array<{ content: string }>): string {
  let combined = rawMessages
    .map((m) => m.content)
    .filter(Boolean)
    .join("\n")
    .replace(SSML_TAGS, "")
    .trim();

  for (const pattern of VOICE_FILLERS) {
    combined = combined.replace(pattern, "").trim();
  }

  combined = combined
    .replace(/^[.\s,]+/g, "")
    .replace(/[,\s]+$/g, "")
    .replace(/\.{2,}/g, ".")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  // Lone punctuation / empty after stripping voice IVR → ask a clear SMS question.
  if (!combined || /^[.\s,]*$/.test(combined)) {
    return SMS_FALLBACK_PROMPT;
  }
  return combined;
}

export function splitIntoSegments(message: string, maxSegmentLength = SMS_MAX_MESSAGE_CHARS): string[] {
  if (message.length <= maxSegmentLength) return [message];

  const words = message.split(/(\s+)/);
  const segs: string[] = [];
  let current = "";

  for (const word of words) {
    const candidate = current + word;
    if (candidate.length <= maxSegmentLength) {
      current = candidate;
    } else {
      if (current.trim()) segs.push(current.trim());
      current = word.trimStart();
    }
  }
  if (current.trim()) segs.push(current.trim());
  return segs.length > 0 ? segs : [message.slice(0, maxSegmentLength)];
}

/** Same confirmation a voice caller receives by SMS, plus department when known. */
export function buildSmsConfirmation(opts: {
  confirmationNumber: string;
  agencyDisplayName: string;
  department?: string;
  mediaCount?: number;
}): string {
  const dept = opts.department?.trim();
  const deptLine = dept
    ? `Dept: ${dept.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}\n`
    : "";
  const mediaLine =
    opts.mediaCount && opts.mediaCount > 0 ? `Media: ${opts.mediaCount} file(s) attached\n` : "";
  return (
    `Your ${opts.agencyDisplayName} non-emergency report has been received.\n` +
    `Confirmation: ${opts.confirmationNumber}\n` +
    deptLine +
    mediaLine +
    `Reference this number if you call back with updates.\n` +
    `Reply HELP for options.`
  );
}

export const SMS_EMERGENCY_MESSAGE =
  "This sounds like an emergency. Do not continue by text. Call 911 now.";
