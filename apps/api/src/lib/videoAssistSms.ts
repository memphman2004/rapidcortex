import { PublishCommand, SNSClient } from "@aws-sdk/client-sns";

const sns = new SNSClient({});

/**
 * Sends SMS with the caller link. Uses direct SNS publish when enabled; otherwise logs for ops.
 * Production: enable SMS in the AWS account and set VIDEO_ASSIST_SNS_DIRECT=1 (or wire Pinpoint).
 */
export async function sendVideoAssistSms(params: {
  phoneE164: string;
  message: string;
}): Promise<{ ok: boolean; providerRef?: string; logOnly?: boolean }> {
  const direct = process.env.VIDEO_ASSIST_SNS_DIRECT?.trim() === "1";
  if (!direct) {
    console.info("[video-assist:sms] VIDEO_ASSIST_SNS_DIRECT!=1 — logging SMS payload only", {
      to: params.phoneE164,
      len: params.message.length,
    });
    return { ok: true, logOnly: true, providerRef: "log-only" };
  }

  try {
    const out = await sns.send(
      new PublishCommand({
        PhoneNumber: params.phoneE164,
        Message: params.message,
      }),
    );
    return { ok: true, providerRef: out.MessageId ?? "sns" };
  } catch (e) {
    console.error("[video-assist:sms] SNS publish failed", e);
    return { ok: false };
  }
}
