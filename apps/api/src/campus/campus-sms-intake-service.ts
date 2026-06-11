import type { ParsedCampusSms } from "./campus-sms-parser.js";
import {
  createCampusSmsIncident,
  findOpenCampusIncidentByPhoneHash,
  markCampusLocationLinkSent,
} from "./campus-incident-service.js";
import { hashPhoneSha256, maskPhoneLast4 } from "../lib/phone-hash.js";
import { incidentTimelineLogger } from "../lib/incidentTimelineLogger.js";
import { requestCarrierLocation } from "../services/carrierLocationService.js";
import {
  recordCampusChatMessage,
  recordManualLocationReply,
  smsLocationService,
} from "../services/smsLocationService.js";
import { WebSocketNotificationService } from "../services/websocketNotificationService.js";

const ws = new WebSocketNotificationService();

function looksLikeManualLocation(text: string): boolean {
  const lower = text.toLowerCase();
  return (
    lower.includes("room") ||
    lower.includes("floor") ||
    lower.includes("building") ||
    lower.includes("hall") ||
    /\b\d{1,4}\b/.test(lower)
  );
}

export async function handleCampusInboundSms(params: {
  parsed: ParsedCampusSms;
  callerPhone: string;
  toPhone: string;
  inboundParams: Record<string, string>;
}): Promise<void> {
  const phoneHash = hashPhoneSha256(params.callerPhone);
  const reporterLast4 = maskPhoneLast4(params.callerPhone);
  const campusCode = params.parsed.campusCode;
  const agencyId = campusCode;

  const existing = await findOpenCampusIncidentByPhoneHash(campusCode, phoneHash);
  if (existing) {
    if (looksLikeManualLocation(params.parsed.cleanDescription)) {
      await recordManualLocationReply({
        campusCode,
        incidentId: existing.id,
        agencyId,
        locationText: params.parsed.cleanDescription,
      });
    } else {
      await recordCampusChatMessage({
        campusCode,
        incidentId: existing.id,
        agencyId,
        messageBody: params.parsed.cleanDescription,
      });
    }
    return;
  }

  const incident = await createCampusSmsIncident({
    campusCode,
    type: params.parsed.detectedType,
    description: params.parsed.cleanDescription,
    buildingHint: params.parsed.buildingHint,
    roomHint: params.parsed.roomHint,
    phoneHash,
    reporterLast4,
  });

  await incidentTimelineLogger.emit({
    incidentId: incident.id,
    agencyId,
    kind: "report_submitted",
    source: "system",
    payload: {
      source: "sms",
      type: params.parsed.detectedType,
      reporterLast4,
    },
  });

  await incidentTimelineLogger.emit({
    incidentId: incident.id,
    agencyId,
    kind: "sms_received",
    source: "system",
    payload: { bodyLength: params.parsed.cleanDescription.length },
  });

  await ws.broadcastIncidentCreated({
    agencyId,
    incidentId: incident.id,
    source: "sms",
    campusCode,
  });

  await Promise.all([
    (async () => {
      await smsLocationService.createAndSendLocationLink({
        incidentId: incident.id,
        agencyId,
        phoneHash,
        callerPhoneE164: params.callerPhone,
        vertical: "campus",
      });
      await markCampusLocationLinkSent(campusCode, incident.id);
    })(),
    (async () => {
      const carrier = await requestCarrierLocation({
        callerPhone: params.callerPhone,
        inboundParams: params.inboundParams,
      });
      if (!carrier) return;
      await smsLocationService.applyCarrierLocation({
        incidentId: incident.id,
        agencyId,
        campusCode,
        coordinates: carrier.coordinates,
      });
    })(),
  ]);
}
