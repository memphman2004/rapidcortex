import type { EscalationRecord } from "rapid-cortex-shared";
import { appendAuditEvent } from "./escalation-db.js";
import { makeId } from "../ids.js";

/**
 * Voice + SMS to a non-RC-Core PSAP. Mock/dry-run when Twilio env is unset.
 */
export async function triggerExternalEscalation(escalation: EscalationRecord): Promise<void> {
  const now = new Date().toISOString();
  const sid = process.env.TWILIO_ACCOUNT_SID?.trim();
  const token = process.env.TWILIO_AUTH_TOKEN?.trim();
  const from = process.env.TWILIO_FROM_NUMBER?.trim();
  const gpsText = escalation.incidentLocation.gps
    ? `GPS ${escalation.incidentLocation.gps.lat.toFixed(5)}, ${escalation.incidentLocation.gps.lng.toFixed(5)}.`
    : "";
  const viewerUrl = `https://app.rapidcortex.us/e/${escalation.viewerToken}`;
  const loc =
    escalation.incidentLocation.section ?? escalation.incidentLocation.description;

  const voiceMessage =
    `This is an automated security escalation from Rapid Cortex. ` +
    `${escalation.sourceAgencyName} security reports a ${escalation.incidentType} ` +
    `at ${loc}. ${gpsText} Full incident details at ${viewerUrl}.`;

  const smsBody =
    `[RC Security Alert] ${escalation.sourceAgencyName}: ` +
    `${escalation.incidentType} at ${loc}. ${gpsText} Full details: ${viewerUrl}`;

  if (!sid || !token || !from) {
    await appendAuditEvent({
      eventId: makeId("esc-evt"),
      escalationId: escalation.escalationId,
      eventType: "escalation.external.mock",
      occurredAt: now,
      actor: "system",
      metadata: { reason: "twilio_not_configured", smsBody },
    });
    return;
  }

  const auth = Buffer.from(`${sid}:${token}`).toString("base64");

  try {
    const callRes = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Calls.json`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        To: escalation.targetPsapPhone,
        From: from,
        Twiml: `<Response><Say voice="alice">${voiceMessage}</Say></Response>`,
      }),
    });
    const callJson = (await callRes.json().catch(() => ({}))) as { sid?: string; message?: string };
    await appendAuditEvent({
      eventId: makeId("esc-evt"),
      escalationId: escalation.escalationId,
      eventType: callRes.ok ? "escalation.voice_call.initiated" : "escalation.voice_call.failed",
      occurredAt: now,
      actor: "system",
      metadata: { callSid: callJson.sid, to: escalation.targetPsapPhone, error: callJson.message },
    });
  } catch (err) {
    await appendAuditEvent({
      eventId: makeId("esc-evt"),
      escalationId: escalation.escalationId,
      eventType: "escalation.voice_call.failed",
      occurredAt: now,
      actor: "system",
      metadata: { error: (err as Error).message },
    });
  }

  try {
    const msgRes = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        To: escalation.targetPsapPhone,
        From: from,
        Body: smsBody,
      }),
    });
    const msgJson = (await msgRes.json().catch(() => ({}))) as { sid?: string; message?: string };
    await appendAuditEvent({
      eventId: makeId("esc-evt"),
      escalationId: escalation.escalationId,
      eventType: msgRes.ok ? "escalation.sms.sent" : "escalation.sms.failed",
      occurredAt: now,
      actor: "system",
      metadata: { smsSid: msgJson.sid, to: escalation.targetPsapPhone, error: msgJson.message },
    });
  } catch (err) {
    await appendAuditEvent({
      eventId: makeId("esc-evt"),
      escalationId: escalation.escalationId,
      eventType: "escalation.sms.failed",
      occurredAt: now,
      actor: "system",
      metadata: { error: (err as Error).message },
    });
  }
}
