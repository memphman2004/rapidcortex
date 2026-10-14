import { z } from "zod";
import { PINPOINT_CONFIG } from "./constants.js";
import type { PinpointIqLocationStatus, PinpointIqLocationStatusView } from "./location-status.js";

export const createPinpointLinkBodySchema = z.object({
  callerPhoneE164: z
    .string()
    .trim()
    .regex(/^\+[1-9]\d{6,14}$/, "Phone must be E.164 (e.g. +15551234567)"),
  /** Optional override for SMS link host (otherwise server env default). */
  publicAppBaseUrl: z.string().url().optional(),
});

export type CreatePinpointLinkBody = z.infer<typeof createPinpointLinkBodySchema>;

/**
 * Browser-channel Pinpoint (campus QR after report) — no SMS.
 * Phone is optional; when present it is stored for ops callback.
 */
export const createBrowserPinpointLinkBodySchema = z.object({
  channel: z.literal("browser"),
  callerPhoneE164: z
    .string()
    .trim()
    .regex(/^\+[1-9]\d{6,14}$/, "Phone must be E.164 (e.g. +15551234567)")
    .optional(),
  publicAppBaseUrl: z.string().url().optional(),
  consentGrantedAt: z.string().datetime().optional(),
});

export type CreateBrowserPinpointLinkBody = z.infer<typeof createBrowserPinpointLinkBodySchema>;

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

/** Public caller consent withdrawal (token-authenticated). */
export const pinpointPublicRevokeBodySchema = z
  .object({
    reason: z
      .enum(["caller_stop", "caller_withdraw_consent", "browser_interrupt"])
      .optional()
      .default("caller_stop"),
  })
  .default({ reason: "caller_stop" });

export type PinpointPublicRevokeBody = z.infer<typeof pinpointPublicRevokeBodySchema>;

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

/**
 * Public caller-facing Pinpoint session (token-authenticated).
 * Must never include incidentId, linkId, agencyId, tokenHash, or full GPS history.
 */
export type PinpointLinkPublicView = {
  status: "active" | "revoked" | "expired";
  expiresAt: string;
  /** True when the session may accept GPS uploads. */
  sharingAllowed: boolean;
  /** Count of server-accepted GPS updates (not the full trail). */
  updateCount: number;
  /** Most recently accepted fix only — never the full ping history. */
  lastAccepted: {
    capturedAt: string;
    lat: number;
    lng: number;
    accuracyM?: number;
  } | null;
};

/** Zod allowlist serializer shape for public responses. */
export const pinpointPublicSessionSchema = z.object({
  status: z.enum(["active", "revoked", "expired"]),
  expiresAt: z.string(),
  sharingAllowed: z.boolean(),
  updateCount: z.number().int().nonnegative(),
  lastAccepted: z
    .object({
      capturedAt: z.string(),
      lat: z.number(),
      lng: z.number(),
      accuracyM: z.number().optional(),
    })
    .nullable(),
});

export type PinpointLinkDispatcherBrief = {
  linkId: string;
  status: string;
  createdAt: string;
  expiresAt: string;
  smsSentAt?: string | null;
  lastPingAt?: string | null;
  channel?: "browser" | "sms" | null;
  consentGrantedAt?: string | null;
};

export type PinpointLinkDispatcherDetail = PinpointLinkDispatcherBrief & {
  agencyId: string;
  incidentId: string;
  pings: PinpointPing[];
  revokedAt?: string | null;
  /** Server-authoritative Pinpoint iQ ops status. */
  locationStatus?: PinpointIqLocationStatus;
  locationStatusView?: PinpointIqLocationStatusView;
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
