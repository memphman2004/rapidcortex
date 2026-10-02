import { randomBytes } from "node:crypto";
import { responsesFor } from "./lex/prompts.js";
import type { CallAssistSessionRecord, CallAssistTenantConfig } from "./store.js";
import {
  decideCallbackOffer,
  interpretCallbackUtterance,
  offerCallbackCampaign,
  shouldOfferSessionCallback,
} from "./callback-campaign.js";
import { sendSelfServiceSms, shouldOfferSessionSms } from "./sms-self-service.js";
import { callerAcceptedOffer, callerDeclinedOffer, callerRequestedSmsLink } from "rapid-cortex-shared";

export async function applyCallAssistCampaigns(opts: {
  session: CallAssistSessionRecord;
  config: CallAssistTenantConfig;
  actorId: string;
  utterance: string;
  hoursOpen: boolean;
  nowIso: string;
}): Promise<CallAssistSessionRecord> {
  let session = opts.session;
  const spoken = responsesFor(opts.config);

  const callbackDecision = interpretCallbackUtterance(session, opts.utterance);
  if (callbackDecision) {
    return decideCallbackOffer({
      session,
      actorId: opts.actorId,
      accept: callbackDecision === "accept",
      nowIso: opts.nowIso,
    });
  }

  if (
    session.smsSelfService?.status === "OFFERED" &&
    (callerAcceptedOffer(opts.utterance) || callerRequestedSmsLink(opts.utterance))
  ) {
    return sendSelfServiceSms({ session, config: opts.config, actorId: opts.actorId, nowIso: opts.nowIso });
  }
  if (session.smsSelfService?.status === "OFFERED" && callerDeclinedOffer(opts.utterance)) {
    session.smsSelfService = { ...session.smsSelfService, status: "DECLINED" };
    return session;
  }

  if (shouldOfferSessionCallback({ config: opts.config, session, hoursOpen: opts.hoursOpen, utterance: opts.utterance })) {
    return offerCallbackCampaign({
      session,
      config: opts.config,
      actorId: opts.actorId,
      nowIso: opts.nowIso,
    });
  }

  if (shouldOfferSessionSms({ session, config: opts.config, utterance: opts.utterance })) {
    session.smsSelfService = {
      token: randomBytes(16).toString("hex"),
      status: "OFFERED",
      portalUrl: opts.config.onlineReportUrl || opts.config.carfaxPortalUrl || "",
    };
    session.nextQuestion = spoken.smsOffer();
    if (callerRequestedSmsLink(opts.utterance) || callerAcceptedOffer(opts.utterance)) {
      return sendSelfServiceSms({ session, config: opts.config, actorId: opts.actorId, nowIso: opts.nowIso });
    }
  }

  return session;
}
