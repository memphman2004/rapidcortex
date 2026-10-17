import { sendIncidentMediaLinkSms } from "../services/sms/smsProviderFactory.js";
import { buildSmsFactoryEnvForAgency } from "../lib/smsFactoryEnv.js";

export type PreArrivalSmsResult = {
  ok: boolean;
  provider: "aws" | "mock" | "config";
  providerRef?: string;
  errorCode?: string;
  errorMessage?: string;
};

export async function sendPreArrivalSms(params: {
  phoneE164: string;
  message: string;
  agencyId: string;
  incidentId: string;
}): Promise<PreArrivalSmsResult> {
  const result = await sendIncidentMediaLinkSms(await buildSmsFactoryEnvForAgency(params.agencyId), {
    toPhoneE164: params.phoneE164,
    messageBody: params.message,
    agencyId: params.agencyId,
    incidentId: params.incidentId,
    messageType: "pre_arrival",
  });

  const provider: PreArrivalSmsResult["provider"] =
    result.provider === "aws" || result.provider === "mock" ? result.provider : "config";

  if (result.status === "sent") {
    return { ok: true, provider, providerRef: result.messageId ?? provider };
  }

  return {
    ok: false,
    provider,
    errorCode: result.errorCode,
    errorMessage: result.errorMessage,
  };
}
