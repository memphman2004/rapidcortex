import { z } from "zod";

export const riskLevelSchema = z.enum(["CRITICAL", "HIGH", "NORMAL", "LOW"]);
export type RiskLevel = z.infer<typeof riskLevelSchema>;

export const hourlyBucketSchema = z.object({
  hourOfDay: z.number().int().min(0).max(23),
  dayOfWeek: z.number().int().min(0).max(6),
  avgCallVolume: z.number().nonnegative(),
  p95CallVolume: z.number().nonnegative(),
  sampleCount: z.number().int().nonnegative(),
});
export type HourlyBucket = z.infer<typeof hourlyBucketSchema>;

export const shiftForecastSchema = z.object({
  date: z.string(),
  shiftStart: z.number().int().min(0).max(23),
  shiftEnd: z.number().int().min(0).max(23),
  predictedCallVolume: z.number().nonnegative(),
  confidenceRange: z.tuple([z.number().nonnegative(), z.number().nonnegative()]),
  recommendedDispatchers: z.number().int().positive(),
  currentScheduledDispatchers: z.number().int().nonnegative().nullable(),
  riskLevel: riskLevelSchema,
  riskReason: z.string(),
});
export type ShiftForecast = z.infer<typeof shiftForecastSchema>;

export const weeklyStaffingForecastSchema = z.object({
  agencyId: z.string(),
  generatedAt: z.string(),
  forecastStartDate: z.string(),
  shifts: z.array(shiftForecastSchema),
  weekSummary: z.object({
    peakRiskShift: shiftForecastSchema,
    avgRecommended: z.number().nonnegative(),
    criticalShiftCount: z.number().int().nonnegative(),
    dataQualityNote: z.string().nullable(),
  }),
  modelUsed: z.string(),
});
export type WeeklyStaffingForecast = z.infer<typeof weeklyStaffingForecastSchema>;

export const staffingScheduledEventSchema = z.object({
  label: z.string(),
  date: z.string(),
  expectedVolumeMultiplier: z.number().positive().optional(),
});
export type StaffingScheduledEvent = z.infer<typeof staffingScheduledEventSchema>;
