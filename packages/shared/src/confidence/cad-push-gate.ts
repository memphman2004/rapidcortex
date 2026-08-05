import type { AggregateConfidence } from "./types.js";

export type PictureStatus = AggregateConfidence["pictureStatus"];

/** Statuses that must not push to CAD until the incident picture improves. */
export const CAD_PUSH_BLOCKED_PICTURE_STATUSES: readonly PictureStatus[] = [
  "INCOMPLETE",
  "CONFLICTED",
] as const;

/**
 * Hard gate for CAD write-back when field-confidence analysis exists.
 * Missing analysis → not blocked (agencies without FC / first segments still work).
 */
export function isCadPushBlockedByPictureStatus(
  pictureStatus: PictureStatus | null | undefined,
): boolean {
  if (!pictureStatus) return false;
  return (CAD_PUSH_BLOCKED_PICTURE_STATUSES as readonly string[]).includes(pictureStatus);
}

export function cadPushGateMessage(pictureStatus: PictureStatus): string {
  if (pictureStatus === "CONFLICTED") {
    return "CAD push blocked: conflicting field values in the incident picture. Resolve conflicts before write-back.";
  }
  return "CAD push blocked: incident picture is incomplete (critical gaps). Capture missing fields before write-back.";
}
