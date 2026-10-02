import { sendIncidentMediaLinkSms } from "../services/sms/smsProviderFactory.js";
import { buildSmsFactoryEnvForAgency } from "./smsFactoryEnv.js";
import { VIDEO_ASSIST_SMS_NOT_RECEIVED_MESSAGE } from "rapid-cortex-shared";

/**
 * Outcome of a Caller Video Assist SMS send. `ok=true` requires the shared AWS/mock
 * provider to report `sent` — never returns ok for a log-only / config miss.
 */
export type VideoAssistSmsResult = {
  ok: boolean;
  provider: "aws" | "mock" | "config";
  providerRef?: string;
  logOnly?: false;
  errorCode?: string;
  errorMessage?: string;
};

export { VIDEO_ASSIST_SMS_NOT_RECEIVED_MESSAGE };

export function videoAssistSmsFailureMessage(sms: Pick<VideoAssistSmsResult, "errorCode" | "errorMessage">): string {
  const detail = [sms.errorCode, sms.errorMessage].filter(Boolean).join(": ");
  return detail ? `${VIDEO_ASSIST_SMS_NOT_RECEIVED_MESSAGE} (${detail})` : VIDEO_ASSIST_SMS_NOT_RECEIVED_MESSAGE;
}

/**
 * SMS for Caller Video Assist links. Same AWS End User Messaging path as Silent Text,
 * Live Video, and Pinpoint — not SNS Publish / log-only. Uses messageType `live_video`
 * (same purpose: caller live-video SMS) so the Lambda vendor pack does not need a new enum.
 */
export async function sendVideoAssistSms(params: {
  phoneE164: string;
  message: string;
  agencyId: string;
  incidentId: string;
}): Promise<VideoAssistSmsResult> {
  const result = await sendIncidentMediaLinkSms(await buildSmsFactoryEnvForAgency(params.agencyId), {
    toPhoneE164: params.phoneE164,
    messageBody: params.message,
    agencyId: params.agencyId,
    incidentId: params.incidentId,
    messageType: "live_video",
  });

  const provider: VideoAssistSmsResult["provider"] =
    result.provider === "aws" || result.provider === "mock" ? result.provider : "config";

  if (result.status === "sent") {
    console.info(
      JSON.stringify({
        type: "video_assist.sms",
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
      type: "video_assist.sms",
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
