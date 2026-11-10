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

/** 15-minute surge forecast bucket for the predictive dispatch strip. */
export const surgeForecastConfidenceSchema = z.enum(["high", "medium", "low"]);
export type SurgeForecastConfidence = z.infer<typeof surgeForecastConfidenceSchema>;

export const surgeForecastBucketSchema = z.object({
  startAt: z.string(),
  endAt: z.string(),
  forecastedCalls: z.number().nonnegative(),
  historicalAvg: z.number().nonnegative(),
  confidenceLevel: surgeForecastConfidenceSchema,
  pressureIndex: z.number().min(0).max(1),
});
export type SurgeForecastBucket = z.infer<typeof surgeForecastBucketSchema>;

export const surgeForecastResponseSchema = z.object({
  agencyId: z.string(),
  generatedAt: z.string(),
  windowMinutes: z.number().int().positive(),
  buckets: z.array(surgeForecastBucketSchema),
  staffingAlert: z.boolean(),
  staffingAlertReason: z.string().nullable(),
  historyDays: z.number().int().nonnegative(),
  unitsAvailable: z.number().nonnegative().optional(),
});
export type SurgeForecastResponse = z.infer<typeof surgeForecastResponseSchema>;
