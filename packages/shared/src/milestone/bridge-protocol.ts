/**
 * Stable HTTPS contract between Rapid Cortex cloud Lambdas and the on-prem
 * Milestone Bridge (MIP SDK / XProtect REST). Cloud never calls XProtect directly.
 */

import type {
  MilestoneAlarmBody,
  MilestoneCameraDto,
  MilestoneEventBody,
  MilestoneLiveTicket,
  MilestoneOutboundAck,
} from "./schemas.js";

/** Bridge GET /v1/health */
export type MilestoneBridgeHealth = {
  ok: boolean;
  xprotectConnected: boolean;
  siteLabel?: string;
  version?: string;
};

/** Bridge GET /v1/cameras */
export type MilestoneBridgeCameraList = {
  cameras: MilestoneBridgeCamera[];
};

/** Camera row returned by the bridge catalog sync. */
export type MilestoneBridgeCamera = MilestoneCameraDto & {
  /** Raw Milestone/XProtect device path when available. */
  devicePath?: string;
  /** RTSP URL when the bridge can expose it for KVS producers. */
  rtspUrl?: string;
};

/** Bridge POST /v1/cameras/{cameraId}/live */
export type MilestoneBridgeLiveRequest = {
  format?: "hls" | "jpeg" | "webrtc";
  incidentId?: string;
};

export type MilestoneBridgeLiveResponse = MilestoneLiveTicket;

/** Bridge POST /v1/events — RC SOC incident → XProtect event/bookmark */
export type MilestoneBridgeEventRequest = MilestoneEventBody & {
  agencyId: string;
};

export type MilestoneBridgeEventResponse = MilestoneOutboundAck;

/** Bridge POST /v1/alarms — RC incident → XProtect alarm / I/O */
export type MilestoneBridgeAlarmRequest = MilestoneAlarmBody & {
  agencyId: string;
};

export type MilestoneBridgeAlarmResponse = MilestoneOutboundAck;

export const MILESTONE_BRIDGE_PATHS = {
  health: "/v1/health",
  cameras: "/v1/cameras",
  live: (cameraId: string) => `/v1/cameras/${encodeURIComponent(cameraId)}/live`,
  events: "/v1/events",
  alarms: "/v1/alarms",
} as const;

/** HMAC header names for cloud → bridge auth. */
export const MILESTONE_BRIDGE_AUTH = {
  timestampHeader: "X-RC-Milestone-Timestamp",
  signatureHeader: "X-RC-Milestone-Signature",
  /** Signature format: v1=<hex HMAC-SHA256(secret, `${timestamp}.${method}.${path}.${body}`)>. */
  signaturePrefix: "v1=",
} as const;
