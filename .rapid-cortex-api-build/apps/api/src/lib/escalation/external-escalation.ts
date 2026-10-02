import type { EscalationRecord } from "rapid-cortex-shared";
import { sendIncidentMediaLinkSms } from "../../services/sms/smsProviderFactory.js";
import { appendAuditEvent } from "./escalation-db.js";
import { makeId } from "../ids.js";
import { buildSmsFactoryEnvForAgency } from "../smsFactoryEnv.js";

/**
 * SMS to a non-RC-Core PSAP via AWS End User Messaging.
 * Voice PSTN is not implemented on the AWS SMS path; that is audited as skipped.
 */
export async function triggerExternalEscalation(escalation: EscalationRecord): Promise<void> {
  const now = new Date().toISOString();
  const gpsText = escalation.incidentLocation.gps
    ? `GPS ${escalation.incidentLocation.gps.lat.toFixed(5)}, ${escalation.incidentLocation.gps.lng.toFixed(5)}.`
    : "";
  const viewerUrl = `https://app.rapidcortex.us/e/${escalation.viewerToken}`;
  const loc = escalation.incidentLocation.section ?? escalation.incidentLocation.description;

  const smsBody =
    `[RC Security Alert] ${escalation.sourceAgencyName}: ` +
    `${escalation.incidentType} at ${loc}. ${gpsText} Full details: ${viewerUrl}`;

  await appendAuditEvent({
    eventId: makeId("esc-evt"),
    escalationId: escalation.escalationId,
    eventType: "escalation.voice_call.skipped",
    occurredAt: now,
    actor: "system",
    metadata: { reason: "aws_sms_only", to: escalation.targetPsapPhone },
  });

  try {
    const result = await sendIncidentMediaLinkSms(
      await buildSmsFactoryEnvForAgency(escalation.sourceAgencyId),
      {
        toPhoneE164: escalation.targetPsapPhone,
        messageBody: smsBody,
        agencyId: escalation.sourceAgencyId,
        incidentId: escalation.incidentId,
        messageType: "silent_text",
      },
    );
    await appendAuditEvent({
      eventId: makeId("esc-evt"),
      escalationId: escalation.escalationId,
      eventType: result.status === "sent" ? "escalation.sms.sent" : "escalation.sms.failed",
      occurredAt: now,
      actor: "system",
      metadata: {
        smsSid: result.messageId,
        to: escalation.targetPsapPhone,
        provider: result.provider,
        error: result.errorMessage,
      },
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
