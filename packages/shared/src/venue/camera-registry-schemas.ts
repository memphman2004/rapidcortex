import { z } from "zod";

/** RTSP / VMS vendors for venue, campus, and transit fixed cameras (no Ring). */
export const venueCameraVendorSchema = z.enum([
  "axis_rtsp",
  "hanwha_rtsp",
  "bosch_rtsp",
  "genetec",
  "milestone",
  "avigilon",
  "onvif",
  "generic_rtsp",
]);

export const venueCameraStatusSchema = z.enum(["online", "offline", "unknown"]);

export const venueCameraSchema = z.object({
  agencyId: z.string().min(1),
  cameraId: z.string().min(1),
  displayName: z.string().min(1),
  vendor: venueCameraVendorSchema,
  kvsChannelName: z.string().min(1),
  rtspUrl: z.string().optional(),
  cameraIp: z.string().optional(),
  sections: z.array(z.string().min(1)).min(1),
  /** Campus vertical: building identifier for intake camera lookup. */
  buildingId: z.string().min(1).optional(),
  /** Campus vertical: floor label/number for intake camera lookup. */
  floor: z.string().min(1).optional(),
  /** Campus vertical: zone / room code for nearest-camera ranking. */
  zoneCode: z.string().min(1).max(32).optional(),
  /** Campus vertical: QR / RCLI of a blue-light, door, or emergency phone this camera covers. */
  qrRcli: z.string().min(1).max(32).optional(),
  /** Physical campus for multi-campus tenants. */
  siteCode: z.string().min(2).max(20).optional(),
  /** Transit vertical: onboard camera on a vehicle. */
  vehicleId: z.string().min(1).max(64).optional(),
  /** Transit vertical: platform / station camera. */
  stationId: z.string().min(1).max(64).optional(),
  /** Transit vertical: route this camera covers. */
  routeId: z.string().min(1).max(64).optional(),
  assetKind: z.enum(["camera", "blue_light", "door", "emergency_phone"]).optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  priorityRank: z.number().int().min(1).max(999),
  ptzCapable: z.boolean(),
  status: venueCameraStatusSchema,
  lastHeartbeat: z.string().optional(),
});

export const venueCameraUpsertBodySchema = z.object({
  cameraId: z.string().min(1).optional(),
  displayName: z.string().min(1),
  vendor: venueCameraVendorSchema,
  /** Auto-generated as rc-{agencyId}-{cameraId} when omitted on create. */
  kvsChannelName: z.string().min(1).optional(),
  rtspUrl: z.string().optional(),
  cameraIp: z.string().optional(),
  sections: z.array(z.string().min(1)).min(1),
  /** Campus vertical: building identifier for intake camera lookup. */
  buildingId: z.string().min(1).optional(),
  /** Campus vertical: floor label/number for intake camera lookup. */
  floor: z.string().min(1).optional(),
  zoneCode: z.string().min(1).max(32).optional(),
  qrRcli: z.string().min(1).max(32).optional(),
  siteCode: z.string().min(2).max(20).optional(),
  vehicleId: z.string().min(1).max(64).optional(),
  stationId: z.string().min(1).max(64).optional(),
  routeId: z.string().min(1).max(64).optional(),
  assetKind: z.enum(["camera", "blue_light", "door", "emergency_phone"]).optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  priorityRank: z.number().int().min(1).max(999),
  ptzCapable: z.boolean().default(false),
  status: venueCameraStatusSchema.optional(),
});

export const venueCamerasQuerySchema = z.object({
  section: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(20).optional(),
});

export const campusCamerasQuerySchema = z.object({
  building: z.string().min(1).optional(),
  floor: z.string().min(1).optional(),
  zone: z.string().min(1).optional(),
  qrRcli: z.string().min(1).optional(),
  /** Comma-separated camera IDs assigned to the scanned QR / area. */
  cameraIds: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(20).optional(),
});

export const transitCamerasQuerySchema = z.object({
  vehicle: z.string().min(1).optional(),
  station: z.string().min(1).optional(),
  route: z.string().min(1).optional(),
  /** Comma-separated camera IDs assigned on the vehicle record. */
  cameraIds: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(20).optional(),
});

export const venueIncidentCameraSummarySchema = z.object({
  cameraId: z.string(),
  displayName: z.string(),
  kvsChannelName: z.string(),
  vendor: venueCameraVendorSchema,
  ptzCapable: z.boolean(),
  status: venueCameraStatusSchema.optional(),
  vehicleId: z.string().optional(),
  stationId: z.string().optional(),
  routeId: z.string().optional(),
});

export const venueIncidentUpdateBodySchema = z.object({
  message: z.string().min(1).max(2000),
});

export const venueIncidentStatusPatchSchema = z.object({
  status: z.enum(["open", "assigned", "responding", "resolved", "escalated"]),
});

export const venueCameraViewerTokenQuerySchema = z.object({
  kvsChannelName: z.string().min(1),
});

export const venueCameraPtzBodySchema = z.object({
  action: z.enum(["pan_left", "pan_right", "tilt_up", "tilt_down", "zoom_in", "zoom_out"]),
});

export const venueCameraDiscoverBodySchema = z.object({
  ip: z.string().min(1),
  username: z.string().optional(),
  password: z.string().optional(),
  port: z.coerce.number().int().min(1).max(65535).optional().default(80),
});

export const venueCameraDiscoverResponseSchema = z.object({
  displayName: z.string(),
  rtspUrl: z.string(),
  ptzCapable: z.boolean(),
  vendor: z.literal("onvif"),
  cameraIp: z.string(),
  model: z.string().optional(),
  manufacturer: z.string().optional(),
});

export const RTSP_PRODUCER_VENDORS = new Set([
  "axis_rtsp",
  "hanwha_rtsp",
  "bosch_rtsp",
  "onvif",
  "generic_rtsp",
  "avigilon",
  "genetec",
  "milestone",
]);

export function isRtspProducerVendor(vendor: z.infer<typeof venueCameraVendorSchema>): boolean {
  return RTSP_PRODUCER_VENDORS.has(vendor);
}

export type VenueCamera = z.infer<typeof venueCameraSchema>;
export type VenueCameraUpsertBody = z.infer<typeof venueCameraUpsertBodySchema>;
export type VenueIncidentCameraSummary = z.infer<typeof venueIncidentCameraSummarySchema>;
export type VenueIncidentUpdateBody = z.infer<typeof venueIncidentUpdateBodySchema>;
export type VenueIncidentStatusPatch = z.infer<typeof venueIncidentStatusPatchSchema>;
export type VenueCameraDiscoverBody = z.infer<typeof venueCameraDiscoverBodySchema>;
export type VenueCameraDiscoverResponse = z.infer<typeof venueCameraDiscoverResponseSchema>;

/** KVS channel naming: rc-{agencyId}-{cameraId} (max 256 chars). */
export function venueKvsChannelName(agencyId: string, cameraId: string): string {
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
  const name = `rc-${slug}-${cam}`.replace(/-+/g, "-");
  return name.length <= 256 ? name : name.slice(0, 256);
}
