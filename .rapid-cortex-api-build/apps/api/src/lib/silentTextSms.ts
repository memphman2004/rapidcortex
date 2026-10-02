import { sendIncidentMediaLinkSms } from "../services/sms/smsProviderFactory.js";
import { buildSmsFactoryEnvForAgency } from "./smsFactoryEnv.js";

/**
 * Outcome of a Silent Text SMS send. `ok=true` requires a real send by AWS/mock —
 * never returns ok on a config error so the caller can mark the session `failed` and audit.
 */
export type SilentTextSmsResult = {
  ok: boolean;
  /** Provider that actually attempted the send. */
  provider: "aws" | "mock" | "config";
  providerRef?: string;
  /** Always false now — kept only for backwards-compat with the persisted event metadata. */
  logOnly?: false;
  errorCode?: string;
  errorMessage?: string;
};

/**
 * SMS for Silent Text safety links. Delegates to the shared SMS provider factory
 * (AWS End User Messaging, same path as incident media and Pinpoint).
 */
export async function sendSilentTextSms(params: {
  phoneE164: string;
  message: string;
  agencyId: string;
  incidentId: string;
}): Promise<SilentTextSmsResult> {
  const result = await sendIncidentMediaLinkSms(await buildSmsFactoryEnvForAgency(params.agencyId), {
    toPhoneE164: params.phoneE164,
    messageBody: params.message,
    agencyId: params.agencyId,
    incidentId: params.incidentId,
    messageType: "silent_text",
  });

  const provider: SilentTextSmsResult["provider"] =
    result.provider === "aws" || result.provider === "mock" ? result.provider : "config";

  if (result.status === "sent") {
    console.info(
      JSON.stringify({
        type: "silent_text.sms",
        outcome: "sent",
        provider,
        agencyId: params.agencyId,
        incidentId: params.incidentId,
        destinationMasked: result.recipientRedacted,
      }),
    );
    return {
      ok: true,
      provider,
      providerRef: result.messageId ?? provider,
    };
  }

  console.error(
    JSON.stringify({
      type: "silent_text.sms",
      outcome: "failed",
      provider,
      agencyId: params.agencyId,
      incidentId: params.incidentId,
      destinationMasked: result.recipientRedacted,
      errorCode: result.errorCode,
      retryable: result.retryable === true,
    }),
  );

  return {
    ok: false,
    provider,
    errorCode: result.errorCode,
    errorMessage: result.errorMessage,
  };
}
