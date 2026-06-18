import { parseCampusSmsForCode } from "../campus/campus-sms-parser.js";
import { handleCampusInboundSms } from "../campus/campus-sms-intake-service.js";
import { parseVenueSmsForCode } from "../venue/venue-sms-parser.js";
import { smsRoutingService } from "./smsRoutingService.js";
import { logUnroutedInboundSms } from "./smsInboundUnrouted.js";
import { handleVenueInboundSms } from "../venue/venue-sms-intake-service.js";
import { venueCodeFromAgencyId } from "../handlers/vertical/agency-id.js";

export async function routeInboundSms(params: {
  toPhone: string;
  callerPhone: string;
  rawBody: string;
  inboundParams: Record<string, string>;
}): Promise<"handled" | "unrouted"> {
  const route = await smsRoutingService.resolveAgencyFromPhone(params.toPhone);
  if (!route) {
    await logUnroutedInboundSms({
      toPhone: params.toPhone,
      fromPhone: params.callerPhone,
      rawBody: params.rawBody,
    });
    return "unrouted";
  }

  if (route.vertical === "campus") {
    const parsed = parseCampusSmsForCode(route.agencyId, params.rawBody, params.rawBody);
    await handleCampusInboundSms({
      parsed,
      callerPhone: params.callerPhone,
      toPhone: params.toPhone,
      inboundParams: params.inboundParams,
    });
    return "handled";
  }

  if (route.vertical === "venue") {
    const venueCode = venueCodeFromAgencyId(route.agencyId);
    const parsed = parseVenueSmsForCode(venueCode, params.rawBody, params.rawBody);
    await handleVenueInboundSms({
      agencyId: route.agencyId,
      parsed,
      callerPhone: params.callerPhone,
      toPhone: params.toPhone,
      inboundParams: params.inboundParams,
    });
    return "handled";
  }

  await logUnroutedInboundSms({
    toPhone: params.toPhone,
    fromPhone: params.callerPhone,
    rawBody: params.rawBody,
  });
  return "unrouted";
}
