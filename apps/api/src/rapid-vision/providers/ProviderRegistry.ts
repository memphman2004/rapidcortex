import type { VisionProvider } from "rapid-cortex-shared";
import { env } from "../../lib/env.js";
import { LiveVideoRepository } from "../../repositories/liveVideoRepository.js";
import type { CameraProvider } from "./CameraProvider.js";
import { CallerVideoProvider } from "./CallerVideoProvider.js";
import { DemoVisionProvider } from "./DemoVisionProvider.js";

const demo = new DemoVisionProvider();
let callerVideo: CallerVideoProvider | null = null;

/**
 * Runtime lookup for iQ Vision™ camera sources.
 *
 * Nest / Wyze stay on Connect (`/api/cameras/providers/*`) — they are not VisionProvider
 * values and are never registered here. Caller phone share bridges Live Video (KVS) when
 * `ENABLE_RAPID_VISION_CALLER_VIDEO` is on.
 */
export function getVisionProvider(provider: VisionProvider): CameraProvider | null {
  if (provider === "demo") return demo;
  if (provider === "caller_video") {
    if (!env.enableRapidVisionCallerVideo) return null;
    if (!callerVideo) {
      const liveRepo = new LiveVideoRepository();
      callerVideo = new CallerVideoProvider({
        getActiveSessionForIncident: async (agencyId, incidentId) => {
          try {
            const session = await liveRepo.getByIncidentId(agencyId, incidentId);
            if (!session) return null;
            if (session.status !== "active" && session.status !== "pending") return null;
            const channel = session.signalingChannelName?.trim();
            if (!channel) return null;
            return {
              sessionId: session.sessionId,
              incidentId: session.incidentId,
              agencyId: session.agencyId,
              kvsChannelName: channel,
              kvsStreamArn: session.kvsVideoStreamArn?.trim() || null,
              status: session.status === "active" ? "active" : "active",
              startedAt: session.activatedAt ?? session.createdAt,
              expiresAt: session.expiresAt,
            };
          } catch {
            // LIVE_VIDEO_SESSIONS_TABLE unset or query failed — treat as no caller source.
            return null;
          }
        },
      });
    }
    return callerVideo;
  }
  return null;
}

export { DemoVisionProvider } from "./DemoVisionProvider.js";
export { CallerVideoProvider } from "./CallerVideoProvider.js";
export type { CameraProvider } from "./CameraProvider.js";
