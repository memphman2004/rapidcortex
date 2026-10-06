import { buildSmsFactoryEnvForAgency } from "../../lib/smsFactoryEnv.js";
import { sendIncidentMediaLinkSms } from "../../services/sms/smsProviderFactory.js";
import { SMS_MAX_MESSAGE_CHARS, splitIntoSegments } from "./message-formatter.js";

/** Only used when a reply exceeds AWS's single MessageBody limit. */
const SEGMENT_GAP_MS = 2_500;

function extraMock(): boolean {
  const v = process.env.SMS_MOCK?.trim().toLowerCase();
  return v === "1" || v === "true";
}

export async function sendSmsSegments(opts: {
  agencyId: string;
  toPhoneE164: string;
  message: string;
  sessionId: string;
  messageType?: "call_assist_confirmation";
}): Promise<void> {
  const smsEnv = await buildSmsFactoryEnvForAgency(opts.agencyId, { extraMock: extraMock() });
  // Call Assist DID is the inbound/outbound number; use it when the agency has no
  // SMS routing row so replies come from the same 10DLC citizens texted.
  const callAssistOrigination = process.env.CALL_ASSIST_SMS_ORIGINATION_NUMBER?.trim();
  if (!smsEnv.agencySenderE164 && callAssistOrigination) {
    smsEnv.agencySenderE164 = callAssistOrigination;
  }
  // Prefer one SendTextMessage so the carrier concatenates in order. Splitting into
  // many short API sends caused handsets to show bubbles out of sequence.
  const segments = splitIntoSegments(opts.message, SMS_MAX_MESSAGE_CHARS);
  for (let i = 0; i < segments.length; i += 1) {
    await sendIncidentMediaLinkSms(smsEnv, {
      toPhoneE164: opts.toPhoneE164,
      messageBody: segments[i]!,
      agencyId: opts.agencyId,
      incidentId: opts.sessionId,
      messageType: opts.messageType ?? "call_assist_confirmation",
    });
    if (i < segments.length - 1) {
      await new Promise((r) => setTimeout(r, SEGMENT_GAP_MS));
    }
  }
}
