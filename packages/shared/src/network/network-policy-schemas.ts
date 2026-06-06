import { z } from "zod";

const timeWindowSchema = z.object({
  startHour: z.number().int().min(0).max(23),
  startMinute: z.number().int().min(0).max(59),
  endHour: z.number().int().min(0).max(23),
  endMinute: z.number().int().min(0).max(59),
});

const dailyScheduleSchema = z.object({
  enabled: z.boolean(),
  windows: z.array(timeWindowSchema).max(8),
});

const scheduleShape = {
  monday: dailyScheduleSchema,
  tuesday: dailyScheduleSchema,
  wednesday: dailyScheduleSchema,
  thursday: dailyScheduleSchema,
  friday: dailyScheduleSchema,
  saturday: dailyScheduleSchema,
  sunday: dailyScheduleSchema,
} as const;

const shiftScheduleSchema = z.object({
  timezone: z.string().min(1).max(64),
  schedule: z.object(scheduleShape),
});

export const patchAgencyNetworkPolicyBodySchema = z
  .object({
    ipAllowlistEnabled: z.boolean().optional(),
    timeRestrictionEnabled: z.boolean().optional(),
    shiftSchedule: shiftScheduleSchema.optional(),
    allowEmergencyOverride: z.boolean().optional(),
  })
  .strict();

export const addNetworkCidrBodySchema = z.object({
  cidr: z.string().min(3).max(64),
  label: z.string().min(1).max(120),
});

export const grantEmergencyOverrideBodySchema = z.object({
  userId: z.string().min(1).max(128),
  reason: z.string().min(3).max(500),
});

export const emergencyOverrideRequestBodySchema = z.object({
  reason: z.string().min(3).max(500),
});

export type PatchAgencyNetworkPolicyBody = z.infer<typeof patchAgencyNetworkPolicyBodySchema>;
export type AddNetworkCidrBody = z.infer<typeof addNetworkCidrBodySchema>;
export type GrantEmergencyOverrideBody = z.infer<typeof grantEmergencyOverrideBodySchema>;
export type EmergencyOverrideRequestBody = z.infer<typeof emergencyOverrideRequestBodySchema>;
