import type { Handler } from "aws-lambda";
import { LiveVideoService } from "../services/liveVideoService.js";

type LiveVideoExportEvent = {
  sessionId?: string;
};

/**
 * Async GetClip → S3 export. Invoked with InvocationType=Event from hang-up paths.
 * Does not accept caller tokens; sessionId is an internal identifier on the live-video table.
 */
export const handler: Handler<LiveVideoExportEvent, { ok: boolean; errorCode?: string }> = async (event) => {
  const sessionId = typeof event?.sessionId === "string" ? event.sessionId.trim() : "";
  if (!sessionId) return { ok: false, errorCode: "MISSING_SESSION_ID" };
  const svc = new LiveVideoService();
  return svc.exportRecordingBySessionId(sessionId);
};
