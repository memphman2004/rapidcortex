import { describe, expect, it } from "vitest";
import type { VideoAssistDispatcherSession } from "rapid-cortex-shared";
import { VIDEO_ASSIST_SMS_NOT_RECEIVED_MESSAGE } from "rapid-cortex-shared";
import {
  canResendVideoAssistSms,
  videoAssistFailureDetail,
  videoAssistStatusLabel,
} from "./video-assist-status";

function session(partial: Partial<VideoAssistDispatcherSession>): VideoAssistDispatcherSession {
  return {
    sessionId: "vas_1",
    incidentId: "inc_1",
    agencyId: "ag_1",
    status: "failed",
    expiresAt: new Date().toISOString(),
    allowMicrophone: true,
    callerPhoneE164: "+15551234567",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...partial,
  };
}

describe("video assist status copy", () => {
  it("labels a failed session as SMS not sent", () => {
    expect(videoAssistStatusLabel("failed")).toBe("SMS not sent");
  });

  it("allows resend after SMS failure", () => {
    expect(canResendVideoAssistSms("failed")).toBe(true);
    expect(canResendVideoAssistSms("sms_sent")).toBe(true);
    expect(canResendVideoAssistSms("ended")).toBe(false);
    expect(canResendVideoAssistSms("canceled")).toBe(false);
  });

  it("explains that the caller did not receive the message", () => {
    expect(videoAssistFailureDetail(session({ lastError: null }))).toBe(
      VIDEO_ASSIST_SMS_NOT_RECEIVED_MESSAGE,
    );
    expect(
      videoAssistFailureDetail(
        session({ lastError: `${VIDEO_ASSIST_SMS_NOT_RECEIVED_MESSAGE} (ACCESS_DENIED)` }),
      ),
    ).toContain("ACCESS_DENIED");
    expect(videoAssistFailureDetail(session({ status: "sms_sent", lastError: null }))).toBeNull();
  });
});
