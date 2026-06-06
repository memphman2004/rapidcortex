import { z } from "zod";

export const venueCameraRequestBodySchema = z.object({
  incidentId: z.string().trim().min(1),
  facilityId: z.string().trim().min(1),
  cameraId: z.string().trim().min(1),
});

export type VenueCameraRequestBody = z.infer<typeof venueCameraRequestBodySchema>;

export const venueIntelligenceQuerySchema = z.object({
  address: z.string().trim().min(1).max(500),
  incidentId: z.string().trim().min(1).optional(),
  incidentType: z.string().trim().min(1).optional(),
  floor: z.coerce.number().int().min(1).optional(),
});

export type VenueIntelligenceQuery = z.infer<typeof venueIntelligenceQuerySchema>;

/** POST /api/stream/viewer-token — Connect and venue KVS viewer credentials. */
export const streamViewerTokenRequestSchema = z.object({
  sessionId: z.string().trim().min(1),
  product: z.enum(["connect", "venue"]),
});

export type StreamViewerTokenRequest = z.infer<typeof streamViewerTokenRequestSchema>;
