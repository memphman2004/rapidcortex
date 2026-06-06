import { z } from "zod";

export const hospitalDailyMetricsSchema = z.object({
  hospitalId: z.string(),
  agencyId: z.string(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  capacity: z.object({
    avgErBedsAvailable: z.number(),
    avgIcuBedsAvailable: z.number(),
    avgOccupancyRate: z.number().min(0).max(1),
  }),
  wait: z.object({
    avgWaitMinutes: z.number().int().min(0),
    maxWaitMinutes: z.number().int().min(0),
    minWaitMinutes: z.number().int().min(0),
  }),
  diversion: z.object({
    totalHours: z.number().min(0),
    incidents: z.number().int().min(0),
    longestDurationMinutes: z.number().int().min(0),
  }),
  volume: z.object({
    estimatedTransports: z.number().int().min(0),
  }),
  dataPoints: z.number().int().min(0),
});
export type HospitalDailyMetrics = z.infer<typeof hospitalDailyMetricsSchema>;

export const hospitalPerformanceScoreSchema = z.object({
  hospitalId: z.string(),
  hospitalName: z.string(),
  periodDays: z.number().int().positive(),
  scores: z.object({
    availability: z.number().min(0).max(100),
    speed: z.number().min(0).max(100),
    reliability: z.number().min(0).max(100),
    overall: z.number().min(0).max(100),
  }),
  metrics: z.object({
    avgDailyCapacity: z.number(),
    avgWaitTime: z.number(),
    diversionRate: z.number(),
    uptimePercent: z.number(),
  }),
  rank: z.number().int().min(0),
  trend: z.enum(["IMPROVING", "STABLE", "DECLINING"]),
});
export type HospitalPerformanceScore = z.infer<typeof hospitalPerformanceScoreSchema>;

export const hospitalAnalyticsQuerySchema = z.object({
  hospitalId: z.string().min(1).max(120),
  days: z.coerce.number().int().min(1).max(365).optional().default(30),
});

export const hospitalLeaderboardQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(365).optional().default(30),
});
