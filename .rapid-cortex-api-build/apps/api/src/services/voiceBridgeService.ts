import type { VoiceBridgeOutboundBody, VoiceBridgeOutboundResponse, UserContext } from "rapid-cortex-shared";
import { normalizeCallLanguageCode, toTranslatePrimaryTag } from "rapid-cortex-shared";
import { AUDIT_EVENT_TYPES, TenantAccessGuard } from "rapid-cortex-security";
import { env } from "../lib/env.js";
import { makeId } from "../lib/ids.js";
import { ActiveCallRepository } from "../repositories/activeCallRepository.js";
import { AuditRepository } from "../repositories/auditRepository.js";
import { IncidentRepository } from "../repositories/incidentRepository.js";
import { translateFromEnglish, synthesizeTextWithConfiguredProvider } from "./language/languageProviderFactory.js";
import { getMultilingualVoiceConfig } from "../voice/multilingualConfig.js";

export type TelephonyBridgePayload = {
  deliveryId: string;
  agencyId: string;
  incidentId: string;
  callId?: string;
  callerPhone?: string;
  englishText: string;
  translatedText: string;
  targetLanguage: string;
  audioObjectKey?: string;
};

export type TelephonyBridgeResult = {
  telephonyStatus: "queued" | "sent" | "skipped";
  deliveryMode: "mock" | "webhook" | "text_only";
};

/** Pluggable SBC / NG911 media inject — mock when webhook unset. */
export async function deliverVoiceBridgeToTelephony(
  payload: TelephonyBridgePayload,
): Promise<TelephonyBridgeResult> {
  const webhook = env.voiceBridgeTelephonyWebhookUrl?.trim();
  if (!webhook) {
    console.info(
      JSON.stringify({
        type: "voice_bridge.telephony_mock",
        deliveryId: payload.deliveryId,
        agencyId: payload.agencyId,
        incidentId: payload.incidentId,
        callId: payload.callId,
        targetLanguage: payload.targetLanguage,
        chars: payload.translatedText.length,
        hasAudio: Boolean(payload.audioObjectKey),
      }),
    );
    return { telephonyStatus: "queued", deliveryMode: "mock" };
  }

  const res = await fetch(webhook, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-RapidCortex-Delivery-Id": payload.deliveryId },
    body: JSON.stringify({
      deliveryId: payload.deliveryId,
      agencyId: payload.agencyId,
      incidentId: payload.incidentId,
      callId: payload.callId,
      callerPhone: payload.callerPhone,
      englishText: payload.englishText,
      translatedText: payload.translatedText,
      targetLanguage: payload.targetLanguage,
      audioObjectKey: payload.audioObjectKey,
    }),
    signal: AbortSignal.timeout(12_000),
  });
  if (!res.ok) {
    throw new Error(`TELEPHONY_WEBHOOK_FAILED:${res.status}`);
  }
  return { telephonyStatus: "sent", deliveryMode: "webhook" };
}

const incidents = new IncidentRepository();
const auditRepo = new AuditRepository();
const activeCalls = new ActiveCallRepository();

export class VoiceBridgeService {
  async outbound(
    incidentId: string,
    user: UserContext,
    body: VoiceBridgeOutboundBody,
  ): Promise<VoiceBridgeOutboundResponse> {
    if (!env.voiceBridgeEnabled) {
      throw new Error("VOICE_BRIDGE_DISABLED");
    }

    const incident = await incidents.get(incidentId);
    if (!incident) throw new Error("FORBIDDEN");
    TenantAccessGuard.assertIncidentAccess(incident, user);

    const targetRaw =
      body.targetLanguage?.trim() ||
      incident.callerLanguage?.trim() ||
      "";
    if (!targetRaw) throw new Error("CALLER_LANGUAGE_REQUIRED");
    const targetLanguage = normalizeCallLanguageCode(targetRaw);
    const primary = toTranslatePrimaryTag(targetLanguage);
    if (primary === "en" || primary === "und") {
      throw new Error("CALLER_LANGUAGE_NOT_TRANSLATABLE");
    }

    const englishText = body.text.trim();
    const tr = await translateFromEnglish(englishText, targetLanguage, {
      agencyId: user.agencyId,
      incidentId,
    });

    const deliveryId = makeId("vbd");
    let audioObjectKey: string | undefined;
    const cfg = getMultilingualVoiceConfig();
    if (cfg.silentTextTtsEnabled) {
      try {
        const utter = await synthesizeTextWithConfiguredProvider(
          { text: tr.text, languageBcp: targetLanguage, preferredGender: "FEMALE" },
          { agencyId: user.agencyId, sessionId: incidentId, messageId: deliveryId },
        );
        audioObjectKey = utter.storageObjectKey;
      } catch (e) {
        console.error("[voice-bridge] TTS failed; continuing text-only", e);
      }
    }

    let callerPhone: string | undefined;
    if (body.callId) {
      const call = await activeCalls.get(user.agencyId, body.callId);
      if (call && (call.incidentId === incidentId || call.incidentId === undefined)) {
        callerPhone = call.callerPhone;
      }
    }

    let bridge: TelephonyBridgeResult;
    try {
      bridge = await deliverVoiceBridgeToTelephony({
        deliveryId,
        agencyId: user.agencyId,
        incidentId,
        callId: body.callId,
        callerPhone,
        englishText,
        translatedText: tr.text,
        targetLanguage,
        audioObjectKey,
      });
    } catch (e) {
      console.error("[voice-bridge] telephony delivery failed", e);
      bridge = { telephonyStatus: "skipped", deliveryMode: "text_only" };
    }

    await auditRepo.create({
      eventId: makeId("audit"),
      agencyId: user.agencyId,
      incidentId,
      actorId: user.userId,
      type: AUDIT_EVENT_TYPES.VOICE_BRIDGE_OUTBOUND,
      details: {
        deliveryId,
        targetLanguage,
        callId: body.callId,
        sessionId: body.sessionId,
        deliveryMode: bridge.deliveryMode,
        telephonyStatus: bridge.telephonyStatus,
        hasAudio: Boolean(audioObjectKey),
        chars: tr.text.length,
      },
      createdAt: new Date().toISOString(),
      resourceType: "incident",
      resourceId: incidentId,
    });

    return {
      deliveryId,
      targetLanguage,
      translatedText: tr.text,
      englishText,
      deliveryMode: bridge.deliveryMode,
      audioObjectKey,
      telephonyStatus: bridge.telephonyStatus,
    };
  }
}
