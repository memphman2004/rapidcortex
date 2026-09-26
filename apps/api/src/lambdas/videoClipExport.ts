import type { Handler } from "aws-lambda";
import { exportPendingClip } from "../services/videoDvrService.js";

type VideoClipExportEvent = {
  agencyId?: string;
  clipId?: string;
};

/**
 * Async GetClip → S3 export for NexCort iQ Video DVR clips.
 * Invoked with InvocationType=Event from the video HTTP catch-all.
 */
export const handler: Handler<VideoClipExportEvent, { ok: boolean; errorCode?: string }> = async (event) => {
  const agencyId = typeof event?.agencyId === "string" ? event.agencyId.trim() : "";
  const clipId = typeof event?.clipId === "string" ? event.clipId.trim() : "";
  if (!agencyId || !clipId) return { ok: false, errorCode: "MISSING_CLIP_KEYS" };
  return exportPendingClip(agencyId, clipId);
};
