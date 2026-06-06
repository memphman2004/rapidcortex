import { z } from "zod";
import { PINPOINT_CONFIG } from "./constants.js";

export const createPinpointLinkBodySchema = z.object({
  callerPhoneE164: z
    .string()
    .trim()
    .regex(/^\+[1-9]\d{6,14}$/, "Phone must be E.164 (e.g. +15551234567)"),
  /** Optional override for SMS link host (otherwise server env default). */
  publicAppBaseUrl: z.string().url().optional(),
});

export type CreatePinpointLinkBody = z.infer<typeof createPinpointLinkBodySchema>;

export const pinpointLocationCaptureBodySchema = z.object({
  lat: z.number().finite().min(-90).max(90),
  lng: z.number().finite().min(-180).max(180),
  accuracyM: z.number().finite().min(0).max(PINPOINT_CONFIG.MAX_ACCURACY_METERS).optional(),
  headingDeg: z.number().finite().min(0).max(359).optional(),
  speedMps: z.number().finite().min(0).max(200).optional(),
  /** Optional short client note (not shown to other callers). */
  clientNote: z.string().max(200).optional(),
});

export type PinpointLocationCaptureBody = z.infer<typeof pinpointLocationCaptureBodySchema>;

export const surgeSplitClusterBodySchema = z.object({
  /** Incident ids to remove from this cluster (remaining incidents stay grouped). */
  incidentIdsToRemove: z.array(z.string().min(1)).min(1).max(48),
});

export type SurgeSplitClusterBody = z.infer<typeof surgeSplitClusterBodySchema>;

export type PinpointPing = {
  capturedAt: string;
  lat: number;
  lng: number;
  accuracyM?: number;
  headingDeg?: number;
  speedMps?: number;
  clientNote?: string;
};

export type PinpointLinkPublicView = {
  linkId: string;
  incidentId: string;
  status: "active" | "revoked" | "expired";
  expiresAt: string;
  pings: PinpointPing[];
};

export type PinpointLinkDispatcherBrief = {
  linkId: string;
  status: string;
  createdAt: string;
  expiresAt: string;
  smsSentAt?: string | null;
  lastPingAt?: string | null;
};

export type PinpointLinkDispatcherDetail = PinpointLinkDispatcherBrief & {
  agencyId: string;
  incidentId: string;
  pings: PinpointPing[];
  revokedAt?: string | null;
};

export type SurgeClusterStatus = "pending" | "confirmed" | "dismissed";

export type SurgeClusterSummary = {
  clusterId: string;
  status: SurgeClusterStatus;
  incidentCount: number;
  confidence: number;
  headlineKeywords: string[];
  updatedAt: string;
  createdAt: string;
};

export type SurgeClusterDetail = SurgeClusterSummary & {
  agencyId: string;
  incidentIds: string[];
  perIncidentKeywords: Record<string, string[]>;
  summary: string;
  uniqueDetails: string[];
};
