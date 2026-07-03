import { z } from "zod";

export const channelDisciplineSchema = z.enum([
  "law",
  "fire",
  "ems",
  "ems_medical",
  "tactical",
  "command",
  "other",
]);

export type ChannelDiscipline = z.infer<typeof channelDisciplineSchema>;

export const channelConfigSchema = z.object({
  agencyId: z.string().min(1),
  channelId: z.string().min(1),
  name: z.string().min(1).max(64),
  description: z.string().max(200).optional(),
  discipline: channelDisciplineSchema,
  talkGroupId: z.string().max(64).optional(),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .optional(),
  active: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
  createdBy: z.string().min(1),
});

export type ChannelConfig = z.infer<typeof channelConfigSchema>;

export const incidentChannelAssignmentSchema = z.object({
  incidentId: z.string().min(1),
  channelId: z.string().min(1),
  agencyId: z.string().min(1),
  channelName: z.string().min(1),
  discipline: channelDisciplineSchema,
  assignedAt: z.string(),
  assignedBy: z.string().min(1),
  notes: z.string().max(500).optional(),
  active: z.boolean(),
  ttl: z.number().int().optional(),
});

export type IncidentChannelAssignment = z.infer<typeof incidentChannelAssignmentSchema>;

export const createChannelBodySchema = z.object({
  name: z.string().min(1).max(64),
  description: z.string().max(200).optional(),
  discipline: channelDisciplineSchema,
  talkGroupId: z.string().max(64).optional(),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .optional(),
});

export const patchChannelBodySchema = createChannelBodySchema.partial().extend({
  active: z.boolean().optional(),
});

export const assignChannelBodySchema = z.object({
  channelId: z.string().min(1).max(128),
  notes: z.string().max(500).optional(),
});

export const patchIncidentChannelBodySchema = z.object({
  notes: z.string().max(500).optional(),
});

export type CreateChannelBody = z.infer<typeof createChannelBodySchema>;
export type PatchChannelBody = z.infer<typeof patchChannelBodySchema>;
export type AssignChannelBody = z.infer<typeof assignChannelBodySchema>;
export type PatchIncidentChannelBody = z.infer<typeof patchIncidentChannelBodySchema>;
