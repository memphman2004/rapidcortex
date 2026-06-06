import { env } from "./env.js";
import { sendIncidentMediaLinkSms } from "../services/sms/smsProviderFactory.js";

/**
 * Outcome of a Silent Text SMS send. `ok=true` requires a real send by Twilio/AWS/mock —
 * never returns ok on a config error so the caller can mark the session `failed` and audit.
 */
export type SilentTextSmsResult = {
  ok: boolean;
  /** Provider that actually attempted the send (twilio | aws | mock | config). */
  provider: "twilio" | "aws" | "mock" | "config";
  providerRef?: string;
  /** Always false now — kept only for backwards-compat with the persisted event metadata. */
  logOnly?: false;
  errorCode?: string;
  errorMessage?: string;
};

/**
 * SMS for Silent Text safety links. Delegates to the shared SMS provider factory so we get
 * Twilio + AWS SNS + auto-failover for free (same path Pinpoint and incident media use).
 *
 * Routing precedence — see `apps/api/src/lib/env.ts` `resolveSmsProviderMode`:
 *   `SMS_PROVIDER` env > legacy Twilio ARN / `INCIDENT_MEDIA_SNS_DIRECT` heuristics > mock fallback.
 *
 * Never resolves `ok=true` if no provider was actually invoked; a missing Twilio secret in a non-mock
 * stage yields `ok=false` with `errorCode=TWILIO_NOT_CONFIGURED` so the session is marked failed.
 */
export async function sendSilentTextSms(params: {
  phoneE164: string;
  message: string;
  agencyId: string;
  incidentId: string;
}): Promise<SilentTextSmsResult> {
  const result = await sendIncidentMediaLinkSms(
    {
      smsProvider: env.smsProvider,
      smsPrimaryProvider: env.smsPrimaryProvider,
      deploymentStage: env.deploymentStage,
      incidentMediaSmsMock: env.incidentMediaSmsMock,
      mockSmsProvider: env.mockSmsProvider,
      awsRegion: env.region,
      awsSmsRegion: env.awsSmsRegion,
      awsSmsUseSimulator: env.awsSmsUseSimulator,
      twilioSecretArn: env.incidentMediaTwilioSecretArn,
      awsSmsConfigurationSetName: env.awsSmsConfigurationSetName,
      awsSmsPoolId: env.awsSmsPoolId,
    },
    {
      toPhoneE164: params.phoneE164,
      messageBody: params.message,
      agencyId: params.agencyId,
      incidentId: params.incidentId,
      messageType: "silent_text",
    },
  );

  const provider: SilentTextSmsResult["provider"] =
    result.provider === "twilio" || result.provider === "aws" || result.provider === "mock"
      ? result.provider
      : "config";

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
