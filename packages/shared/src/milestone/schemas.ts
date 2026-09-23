import { z } from "zod";

/** Agency connects Rapid Cortex cloud to an on-prem Milestone Bridge. */
export const milestoneConnectBodySchema = z
  .object({
    /** HTTPS base URL of the on-prem bridge (e.g. https://bridge.campus.example:8443). */
    bridgeBaseUrl: z.string().url().max(500),
    /** Optional display name for the XProtect site. */
    siteLabel: z.string().min(1).max(120).optional(),
    /** When true, outbound incident events and alarms are sent to the bridge. */
    outboundEnabled: z.boolean().optional().default(true),
  })
  .strict();

export type MilestoneConnectBody = z.infer<typeof milestoneConnectBodySchema>;

export const milestoneStatusSchema = z.object({
  connected: z.boolean(),
  agencyId: z.string().min(1),
  bridgeBaseUrl: z.string().url().optional(),
  siteLabel: z.string().optional(),
  outboundEnabled: z.boolean().optional(),
  lastSyncAt: z.string().datetime().optional(),
  cameraCount: z.number().int().nonnegative().optional(),
  mock: z.boolean().optional(),
});

export type MilestoneStatus = z.infer<typeof milestoneStatusSchema>;

export const milestoneCameraDtoSchema = z.object({
  cameraId: z.string().min(1).max(120),
  displayName: z.string().min(1).max(200),
  /** XProtect GUID or channel id from the bridge. */
  xprotectGuid: z.string().min(1).max(200).optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  buildingId: z.string().min(1).max(64).optional(),
  floor: z.string().min(1).max(32).optional(),
  zoneCode: z.string().min(1).max(32).optional(),
  status: z.enum(["online", "offline", "unknown"]).default("unknown"),
  ptzCapable: z.boolean().default(false),
});

export type MilestoneCameraDto = z.infer<typeof milestoneCameraDtoSchema>;

export const milestoneSyncResultSchema = z.object({
  synced: z.number().int().nonnegative(),
  cameras: z.array(milestoneCameraDtoSchema),
  lastSyncAt: z.string().datetime(),
  mock: z.boolean().optional(),
});

export type MilestoneSyncResult = z.infer<typeof milestoneSyncResultSchema>;

export const milestoneNearCamerasQuerySchema = z.object({
  incidentId: z.string().min(1).max(120),
  campusCode: z.string().min(1).max(64).optional(),
  latitude: z.coerce.number().min(-90).max(90).optional(),
  longitude: z.coerce.number().min(-180).max(180).optional(),
  radiusMeters: z.coerce.number().int().min(50).max(500).optional().default(150),
  limit: z.coerce.number().int().min(1).max(8).optional().default(4),
});

export type MilestoneNearCamerasQuery = z.infer<typeof milestoneNearCamerasQuerySchema>;

export const milestoneLiveTicketBodySchema = z
  .object({
    incidentId: z.string().min(1).max(120).optional(),
    /** Preferred stream format when the bridge supports multiple. */
    format: z.enum(["hls", "jpeg", "webrtc"]).optional().default("hls"),
  })
  .strict();

export type MilestoneLiveTicketBody = z.infer<typeof milestoneLiveTicketBodySchema>;

export const milestoneLiveTicketSchema = z.object({
  cameraId: z.string().min(1),
  streamUrl: z.string().url(),
  format: z.enum(["hls", "jpeg", "webrtc"]),
  expiresAt: z.string().datetime(),
  mock: z.boolean().optional(),
});

export type MilestoneLiveTicket = z.infer<typeof milestoneLiveTicketSchema>;

export const milestoneEventBodySchema = z
  .object({
    incidentId: z.string().min(1).max(120),
    title: z.string().min(1).max(200),
    description: z.string().max(2000).optional(),
    severity: z.enum(["low", "medium", "high", "critical"]).optional().default("medium"),
    latitude: z.number().min(-90).max(90).optional(),
    longitude: z.number().min(-180).max(180).optional(),
    cameraIds: z.array(z.string().min(1).max(120)).max(16).optional(),
  })
  .strict();

export type MilestoneEventBody = z.infer<typeof milestoneEventBodySchema>;

export const milestoneAlarmBodySchema = z
  .object({
    incidentId: z.string().min(1).max(120),
    alarmName: z.string().min(1).max(120).optional().default("RapidCortexIncident"),
    message: z.string().min(1).max(500),
    severity: z.enum(["low", "medium", "high", "critical"]).optional().default("high"),
    cameraIds: z.array(z.string().min(1).max(120)).max(16).optional(),
  })
  .strict();

export type MilestoneAlarmBody = z.infer<typeof milestoneAlarmBodySchema>;

export const milestoneOutboundAckSchema = z.object({
  ok: z.boolean(),
  bridgeEventId: z.string().optional(),
  mock: z.boolean().optional(),
});

export type MilestoneOutboundAck = z.infer<typeof milestoneOutboundAckSchema>;
