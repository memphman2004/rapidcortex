import type { ParsedVenueSms } from "./venue-sms-parser.js";
import { createVenueSmsIncident, type CreateVenueQrIncidentResult } from "./venue-incident-service.js";

export async function handleVenueInboundSms(params: {
  agencyId: string;
  parsed: ParsedVenueSms;
  callerPhone: string;
  toPhone: string;
  inboundParams: Record<string, string>;
}): Promise<CreateVenueQrIncidentResult | null> {
  void params.toPhone;
  void params.inboundParams;
  try {
    return await createVenueSmsIncident({
      agencyId: params.agencyId,
      parsed: params.parsed,
      callerPhone: params.callerPhone,
    });
  } catch (err) {
    console.error("[handleVenueInboundSms] incident creation failed", err);
    return null;
  }
}
