import { z } from "zod";

/**
 * NexiQ Video — agency-owned camera VMS layer (not NexiQ Vision / Ring).
 * Phase 1: Command Video Wall types and concurrent stream cost gates.
 */

export const videoWallLayoutSchema = z.enum(["1x1", "2x2", "3x3", "4x4", "custom"]);
export type VideoWallLayout = z.infer<typeof videoWallLayoutSchema>;

export const videoTileStatusSchema = z.enum(["online", "offline", "unknown"]);
export type VideoTileStatus = z.infer<typeof videoTileStatusSchema>;

export const videoTileAssignmentSchema = z.object({
  position: z.number().int().min(0).max(63),
  cameraId: z.string().min(1).max(128),
  kvsChannelName: z.string().min(1).max(256),
  displayName: z.string().min(1).max(200),
  vendor: z.string().min(1).max(64),
  ptzCapable: z.boolean(),
  section: z.string().min(1).max(64).optional(),
  buildingId: z.string().min(1).max(64).optional(),
  status: videoTileStatusSchema,
});
export type VideoTileAssignment = z.infer<typeof videoTileAssignmentSchema>;

export const videoWallConfigSchema = z.object({
  agencyId: z.string().min(1).max(128),
  userId: z.string().min(1).max(128),
  layout: videoWallLayoutSchema,
  tiles: z.array(videoTileAssignmentSchema).max(64),
  savedAt: z.string().min(1),
});
export type VideoWallConfig = z.infer<typeof videoWallConfigSchema>;

export const videoWallConfigPutBodySchema = z.object({
  layout: videoWallLayoutSchema,
  tiles: z.array(videoTileAssignmentSchema).max(64),
});
export type VideoWallConfigPutBody = z.infer<typeof videoWallConfigPutBodySchema>;

export const cameraHealthSummarySchema = z.object({
  total: z.number().int().min(0),
  online: z.number().int().min(0),
  offline: z.number().int().min(0),
  unknown: z.number().int().min(0),
  lastCheckedAt: z.string().min(1),
});
export type CameraHealthSummary = z.infer<typeof cameraHealthSummarySchema>;

export const videoApiErrorCodeSchema = z.enum([
  "UNAUTHORIZED",
  "FORBIDDEN",
  "NOT_FOUND",
  "CAMERA_OFFLINE",
  "KVS_ERROR",
  "GATEWAY_UNAVAILABLE",
  "RECORDING_NOT_ENABLED",
  "CLIP_TOO_LONG",
  "CLIP_TOO_SHORT",
  "CLIP_LOCKED",
  "STREAM_LIMIT_EXCEEDED",
  "RATE_LIMITED",
  "ANALYTICS_DISABLED",
  "ANALYTICS_NOT_ENABLED",
]);
export type VideoApiErrorCode = z.infer<typeof videoApiErrorCodeSchema>;

export const VIDEO_PTZ_RATE_LIMIT_PER_MINUTE = 60;

export const videoPtzDirectionSchema = z.enum([
  "up",
  "down",
  "left",
  "right",
  "up-left",
  "up-right",
  "down-left",
  "down-right",
]);
export type VideoPtzDirection = z.infer<typeof videoPtzDirectionSchema>;

export const videoPtzSpeedSchema = z.number().int().min(1).max(5);
export type VideoPtzSpeed = z.infer<typeof videoPtzSpeedSchema>;

export const videoPtzMoveBodySchema = z.object({
  direction: videoPtzDirectionSchema,
  speed: videoPtzSpeedSchema.default(3),
});
export type VideoPtzMoveBody = z.infer<typeof videoPtzMoveBodySchema>;

export const videoPtzZoomBodySchema = z.object({
  direction: z.enum(["in", "out"]),
  speed: videoPtzSpeedSchema.default(3),
});
export type VideoPtzZoomBody = z.infer<typeof videoPtzZoomBodySchema>;

export const videoPtzPresetSchema = z.object({
  token: z.string().min(1).max(64),
  name: z.string().min(1).max(64),
});
export type VideoPtzPreset = z.infer<typeof videoPtzPresetSchema>;

export const videoPtzPresetGotoBodySchema = z.object({
  presetToken: z.string().min(1).max(64),
});
export type VideoPtzPresetGotoBody = z.infer<typeof videoPtzPresetGotoBodySchema>;

export const videoPtzPresetSaveBodySchema = z.object({
  presetName: z.string().min(1).max(64),
});
export type VideoPtzPresetSaveBody = z.infer<typeof videoPtzPresetSaveBodySchema>;

export const videoGatewayRelayCommandSchema = z.enum([
  "ContinuousMove",
  "Stop",
  "Zoom",
  "GotoPreset",
  "SetPreset",
  "GetPresets",
]);
export type VideoGatewayRelayCommand = z.infer<typeof videoGatewayRelayCommandSchema>;

export const videoGatewayRelayBodySchema = z.object({
  agencyId: z.string().min(1).max(128),
  cameraId: z.string().min(1).max(128),
  cameraIp: z.string().min(1).max(128).optional(),
  command: videoGatewayRelayCommandSchema,
  direction: videoPtzDirectionSchema.optional(),
  zoomDirection: z.enum(["in", "out"]).optional(),
  speed: videoPtzSpeedSchema.optional(),
  presetToken: z.string().min(1).max(64).optional(),
  presetName: z.string().min(1).max(64).optional(),
});
export type VideoGatewayRelayBody = z.infer<typeof videoGatewayRelayBodySchema>;

/** Maps UI speed 1–5 to ONVIF panTiltVelocity 0.1–0.5. */
export function videoPtzVelocity(speed: number): number {
  const n = Number.isFinite(speed) ? Math.min(5, Math.max(1, Math.round(speed))) : 3;
  return n / 10;
}

export function videoPtzPanTilt(direction: VideoPtzDirection, speed: number): { x: number; y: number } {
  const v = videoPtzVelocity(speed);
  switch (direction) {
    case "up":
      return { x: 0, y: v };
    case "down":
      return { x: 0, y: -v };
    case "left":
      return { x: -v, y: 0 };
    case "right":
      return { x: v, y: 0 };
    case "up-left":
      return { x: -v, y: v };
    case "up-right":
      return { x: v, y: v };
    case "down-left":
      return { x: -v, y: -v };
    case "down-right":
      return { x: v, y: -v };
  }
}

/** KVS GetClip native limit is ~200 fragments / 5 minutes. Longer exports need a later ffmpeg path. */
export const VIDEO_CLIP_MAX_SECONDS = 300;
export const VIDEO_CLIP_MIN_SECONDS = 30;
export const VIDEO_CLIP_TTL_SECONDS = 30 * 24 * 60 * 60;
export const VIDEO_HLS_URL_TTL_SECONDS = 15 * 60;

export const videoRetentionHoursSchema = z.union([
  z.literal(24),
  z.literal(72),
  z.literal(168),
  z.literal(336),
  z.literal(720),
]);
export type VideoRetentionHours = z.infer<typeof videoRetentionHoursSchema>;

export const videoCameraRetentionPolicySchema = z.object({
  enabled: z.boolean(),
  retentionHours: videoRetentionHoursSchema,
  storageClass: z.enum(["standard", "archive"]).default("standard"),
  enabledAt: z.string().min(1).optional(),
});
export type VideoCameraRetentionPolicy = z.infer<typeof videoCameraRetentionPolicySchema>;

export const videoRecordingPatchBodySchema = z.object({
  enabled: z.boolean(),
  retentionHours: videoRetentionHoursSchema.optional(),
});
export type VideoRecordingPatchBody = z.infer<typeof videoRecordingPatchBodySchema>;

export const videoClipStatusSchema = z.enum(["pending", "processing", "ready", "error"]);
export type VideoClipStatus = z.infer<typeof videoClipStatusSchema>;

export const videoClipSchema = z.object({
  clipId: z.string().min(1),
  agencyId: z.string().min(1),
  cameraId: z.string().min(1),
  kvsChannelName: z.string().min(1),
  kvsStreamName: z.string().min(1).optional(),
  displayName: z.string().min(1).max(200),
  incidentId: z.string().min(1).optional(),
  startTime: z.string().min(1),
  endTime: z.string().min(1),
  durationSeconds: z.number().int().min(VIDEO_CLIP_MIN_SECONDS).max(VIDEO_CLIP_MAX_SECONDS),
  s3Key: z.string().optional(),
  s3Bucket: z.string().optional(),
  exportedBy: z.string().min(1),
  exportedAt: z.string().min(1),
  status: videoClipStatusSchema,
  downloadUrl: z.string().optional(),
  errorMessage: z.string().max(500).optional(),
  ttl: z.number().int().optional(),
  locked: z.boolean(),
  tags: z.array(z.string().min(1).max(64)).max(16).optional(),
  label: z.string().max(200).optional(),
});
export type VideoClip = z.infer<typeof videoClipSchema>;

export const videoClipCreateBodySchema = z.object({
  startTime: z.string().min(1),
  endTime: z.string().min(1),
  incidentId: z.string().min(1).max(128).optional(),
  label: z.string().min(1).max(200).optional(),
});
export type VideoClipCreateBody = z.infer<typeof videoClipCreateBodySchema>;

export const videoFragmentSchema = z.object({
  fragmentNumber: z.string().min(1),
  startTime: z.string().min(1),
  endTime: z.string().min(1),
});
export type VideoFragment = z.infer<typeof videoFragmentSchema>;

export const videoPlaybackSessionSchema = z.object({
  cameraId: z.string().min(1),
  kvsStreamName: z.string().min(1),
  hlsUrl: z.string().min(1),
  expiresAt: z.string().min(1),
  startTimestamp: z.string().min(1),
  endTimestamp: z.string().min(1),
});
export type VideoPlaybackSession = z.infer<typeof videoPlaybackSessionSchema>;

export const videoRecordingStatusSchema = z.object({
  cameraId: z.string().min(1),
  enabled: z.boolean(),
  retentionHours: videoRetentionHoursSchema.optional(),
  storageClass: z.enum(["standard", "archive"]).optional(),
  kvsStreamName: z.string().optional(),
  kvsStreamArn: z.string().optional(),
  attachStorageToChannel: z.boolean(),
  enabledAt: z.string().optional(),
});
export type VideoRecordingStatus = z.infer<typeof videoRecordingStatusSchema>;

/** Separate KVS data stream for DVR so live WebRTC on the signaling channel stays P2P. */
export function videoRecordingStreamName(agencyId: string, cameraId: string): string {
  const slug = agencyId
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-");
  const cam = cameraId
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-");
  const name = `rc-vrec-${slug}-${cam}`.replace(/-+/g, "-");
  return name.length <= 256 ? name : name.slice(0, 256);
}

export function clipDurationSeconds(startIso: string, endIso: string): number {
  const start = Date.parse(startIso);
  const end = Date.parse(endIso);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return -1;
  return Math.round((end - start) / 1000);
}

export function assertClipWindow(startIso: string, endIso: string): { ok: true; durationSeconds: number } | { ok: false; code: "CLIP_TOO_LONG" | "CLIP_TOO_SHORT" } {
  const durationSeconds = clipDurationSeconds(startIso, endIso);
  if (durationSeconds < VIDEO_CLIP_MIN_SECONDS) return { ok: false, code: "CLIP_TOO_SHORT" };
  if (durationSeconds > VIDEO_CLIP_MAX_SECONDS) return { ok: false, code: "CLIP_TOO_LONG" };
  return { ok: true, durationSeconds };
}

export const HEARTBEAT_OFFLINE_MS = 5 * 60 * 1000;

/** Layout cell count. Custom defaults to 4 unless the caller passes an explicit size. */
export function videoWallCellCount(layout: VideoWallLayout, customCount = 4): number {
  if (layout === "custom") return Math.min(Math.max(1, customCount), 32);
  const [rows, cols] = layout.split("x").map((n) => Number(n));
  if (!Number.isFinite(rows) || !Number.isFinite(cols)) return 4;
  return rows * cols;
}

/**
 * Concurrent live WebRTC viewers billed per stream-minute.
 * Keys are uppercase canonical roles (CAMPUS_SECURITY, VENUE_ADMIN, dispatcher, …).
 */
export const CONCURRENT_STREAM_LIMITS: Record<string, number> = {
  DISPATCHER: 4,
  CAMPUS_SECURITY: 4,
  CAMPUS_DISPATCH: 4,
  VENUE_SECURITY: 4,
  TRANSIT_SECURITY: 4,
  TRANSIT_OPERATOR: 4,
  CAMPUS_SUPERVISOR: 16,
  VENUE_SUPERVISOR: 16,
  VENUE_OPERATOR: 16,
  TRANSIT_SUPERVISOR: 16,
  CAMPUS_ADMIN: 32,
  VENUE_ADMIN: 32,
  TRANSIT_ADMIN: 32,
  AGENCYADMIN: 32,
  AGENCYIT: 32,
  SUPERVISOR: 32,
  RCSUPERADMIN: 999,
  RCADMIN: 999,
};

const ROLE_ALIASES: Record<string, string> = {
  campussecurity: "CAMPUS_SECURITY",
  campus_security: "CAMPUS_SECURITY",
  campusdispatch: "CAMPUS_DISPATCH",
  campus_dispatch: "CAMPUS_DISPATCH",
  campussupervisor: "CAMPUS_SUPERVISOR",
  campus_supervisor: "CAMPUS_SUPERVISOR",
  campusadmin: "CAMPUS_ADMIN",
  campus_admin: "CAMPUS_ADMIN",
  venue_security: "VENUE_SECURITY",
  venue_supervisor: "VENUE_SUPERVISOR",
  venue_operator: "VENUE_OPERATOR",
  venue_admin: "VENUE_ADMIN",
  transit_security: "TRANSIT_SECURITY",
  transit_operator: "TRANSIT_OPERATOR",
  transit_supervisor: "TRANSIT_SUPERVISOR",
  transit_admin: "TRANSIT_ADMIN",
};

export function normalizeVideoWallRoleKey(role: string): string {
  const trimmed = role.trim();
  const alias = ROLE_ALIASES[trimmed.toLowerCase().replace(/-/g, "_")];
  if (alias) return alias;
  return trimmed.replace(/-/g, "_").toUpperCase();
}

export function concurrentStreamLimitForRole(role: string): number {
  const key = normalizeVideoWallRoleKey(role);
  return CONCURRENT_STREAM_LIMITS[key] ?? 4;
}

export function cameraStatusFromHeartbeat(
  status: string | undefined,
  lastHeartbeat: string | undefined,
  nowMs = Date.now(),
): VideoTileStatus {
  if (lastHeartbeat) {
    const ts = Date.parse(lastHeartbeat);
    if (Number.isFinite(ts) && nowMs - ts > HEARTBEAT_OFFLINE_MS) return "offline";
    if (Number.isFinite(ts) && nowMs - ts <= HEARTBEAT_OFFLINE_MS) return "online";
  }
  if (status === "online" || status === "offline" || status === "unknown") return status;
  return "unknown";
}
