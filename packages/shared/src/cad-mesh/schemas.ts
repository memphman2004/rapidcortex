import { z } from "zod";

const incidentTypeSchema = z.enum([
  "FIRE",
  "EMS",
  "LAW",
  "HAZMAT",
  "TRAFFIC",
  "MCI",
  "WELFARE",
  "OTHER",
]);

export const sendInviteRequestSchema = z.object({
  partnerAgencyId: z.string().trim().min(1).max(128),
  partnerAgencyName: z.string().trim().min(1).max(200).optional(),
  inviteMessage: z.string().trim().max(2000).optional(),
  mouVersion: z.string().trim().min(1).max(32),
});

export const acceptInviteRequestSchema = z.object({
  mouVersion: z.string().trim().min(1).max(32),
});

export const suspendRelationshipSchema = z.object({
  suspend: z.boolean(),
  reason: z.string().trim().max(500).optional(),
});

export const revokeRelationshipSchema = z.object({
  reason: z.string().trim().max(500).optional(),
});

export const updatePolicyRequestSchema = z.object({
  enabled: z.boolean().optional(),
  sharingMode: z.enum(["automatic", "manual", "mutual_aid_only"]).optional(),
  shareIncidentTypes: z.array(z.union([incidentTypeSchema, z.literal("*")])).optional(),
  sharePriorityThreshold: z.union([
    z.literal(1),
    z.literal(2),
    z.literal(3),
    z.literal(4),
    z.literal(5),
  ]).optional(),
  shareFields: z.record(z.string(), z.boolean()).optional(),
  geoBoundaryMiles: z.number().positive().max(500).nullable().optional(),
  hqLat: z.number().gte(-90).lte(90).nullable().optional(),
  hqLon: z.number().gte(-180).lte(180).nullable().optional(),
  writebackEnabled: z.boolean().optional(),
  writebackMode: z.enum(["assisted", "automatic"]).optional(),
  writebackFields: z.record(z.string(), z.boolean()).optional(),
});

export const writebackToggleSchema = z.object({
  enabled: z.boolean(),
  mode: z.enum(["assisted", "automatic"]).optional(),
});

export const writebackApprovalSchema = z.object({
  shareId: z.string().trim().min(1).max(128),
  approved: z.boolean(),
  reason: z.string().trim().max(500).optional(),
});
