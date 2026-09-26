import type { VideoAssistDispatcherSession } from "rapid-cortex-shared";
import { VIDEO_ASSIST_SMS_NOT_RECEIVED_MESSAGE } from "rapid-cortex-shared";

const STATUS_LABEL: Record<VideoAssistDispatcherSession["status"], string> = {
  pending_send: "Link not sent",
  sms_sent: "SMS sent",
  delivered: "Delivered (if supported)",
  opened: "Link opened",
  consent_pending: "Consent recorded",
  permission_pending: "Camera permission pending",
  connecting: "Connecting…",
  live: "Live",
  paused: "Paused / interrupted",
  ended: "Ended",
  failed: "SMS not sent",
  canceled: "Canceled",
};

export function videoAssistStatusLabel(status: VideoAssistDispatcherSession["status"]): string {
  return STATUS_LABEL[status] ?? status;
}

/** Resend is the recovery path when the first SMS never reached the caller. */
export function canResendVideoAssistSms(status: VideoAssistDispatcherSession["status"]): boolean {
  return status !== "ended" && status !== "canceled";
}

export function videoAssistFailureDetail(session: VideoAssistDispatcherSession): string | null {
  if (session.status !== "failed") return null;
  const lastError = session.lastError?.trim();
  return lastError || VIDEO_ASSIST_SMS_NOT_RECEIVED_MESSAGE;
}
