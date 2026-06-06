import { z } from "zod";
import { hospitalProfileSchema } from "../emergency-connect/schemas.js";

export const hospitalBedCountSchema = z.object({
  total: z.number().int().min(0),
  occupied: z.number().int().min(0),
  available: z.number().int().min(0),
});
export type HospitalBedCount = z.infer<typeof hospitalBedCountSchema>;

export const hospitalCapacityDataSourceSchema = z.enum([
  "HL7_FEED",
  "MANUAL_UPDATE",
  "API_INTEGRATION",
  "ESTIMATED",
  "MOCK",
]);
export type HospitalCapacityDataSource = z.infer<typeof hospitalCapacityDataSourceSchema>;

export const hospitalDiversionTypeSchema = z.enum([
  "FULL",
  "TRAUMA",
  "CARDIAC",
  "STROKE",
  "PSYCHIATRIC",
]);
export type HospitalDiversionType = z.infer<typeof hospitalDiversionTypeSchema>;

export const hospitalCapacitySchema = z.object({
  hospitalId: z.string().min(1).max(120),
  agencyId: z.string().min(1).max(120),
  timestamp: z.string().datetime(),
  availability: z.object({
    erBeds: hospitalBedCountSchema,
    icuBeds: hospitalBedCountSchema,
    traumaBeds: hospitalBedCountSchema.optional(),
  }),
  waitTimes: z.object({
    erWaitMinutes: z.number().int().min(0).max(600),
    traumaBayMinutes: z.number().int().min(0).max(600).optional(),
  }),
  diversion: z.object({
    isOnDiversion: z.boolean(),
    diversionType: hospitalDiversionTypeSchema.optional(),
    diversionReason: z.string().max(500).optional(),
    diversionUntil: z.string().datetime().optional(),
    diversionStartedAt: z.string().datetime().optional(),
  }),
  staffing: z.object({
    adequateStaffing: z.boolean(),
    erPhysicians: z.number().int().min(0).optional(),
    erNurses: z.number().int().min(0).optional(),
  }),
  dataQuality: z.object({
    source: hospitalCapacityDataSourceSchema,
    lastVerified: z.string().datetime(),
    confidence: z.enum(["HIGH", "MEDIUM", "LOW"]),
  }),
  updatedByUserId: z.string().max(120).optional(),
  updatedByName: z.string().max(200).optional(),
  updateNotes: z.string().max(500).optional(),
});
export type HospitalCapacity = z.infer<typeof hospitalCapacitySchema>;

export const updateHospitalCapacityBodySchema = z.object({
  availability: hospitalCapacitySchema.shape.availability,
  waitTimes: hospitalCapacitySchema.shape.waitTimes,
  diversion: hospitalCapacitySchema.shape.diversion,
  staffing: hospitalCapacitySchema.shape.staffing,
  dataQuality: hospitalCapacitySchema.shape.dataQuality.partial().optional(),
});
export type UpdateHospitalCapacityBody = z.infer<typeof updateHospitalCapacityBodySchema>;

export const hospitalPatientNeedsSchema = z.object({
  trauma: z.boolean().optional(),
  stroke: z.boolean().optional(),
  stemi: z.boolean().optional(),
  burn: z.boolean().optional(),
  pediatric: z.boolean().optional(),
  psychiatric: z.boolean().optional(),
});
export type HospitalPatientNeeds = z.infer<typeof hospitalPatientNeedsSchema>;

export const hospitalRecommendationsBodySchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  patientNeeds: hospitalPatientNeedsSchema.optional(),
});
export type HospitalRecommendationsBody = z.infer<typeof hospitalRecommendationsBodySchema>;

export const hospitalRecommendationLevelSchema = z.enum([
  "OPTIMAL",
  "ACCEPTABLE",
  "SUBOPTIMAL",
  "NOT_RECOMMENDED",
]);
export type HospitalRecommendationLevel = z.infer<typeof hospitalRecommendationLevelSchema>;

export const hospitalRecommendationScoringSchema = z.object({
  overallScore: z.number().min(0).max(100),
  factors: z.object({
    distance: z.number().min(0).max(100),
    capacity: z.number().min(0).max(100),
    specialtyMatch: z.number().min(0).max(100),
    waitTime: z.number().min(0).max(100),
    historical: z.number().min(0).max(100),
  }),
});
export type HospitalRecommendationScoring = z.infer<typeof hospitalRecommendationScoringSchema>;

export const hospitalRecommendationSchema = z.object({
  hospitalId: z.string(),
  hospital: hospitalProfileSchema,
  capacity: hospitalCapacitySchema,
  routing: z.object({
    distanceMiles: z.number().min(0),
    durationMinutes: z.number().int().min(0),
    durationLightsMinutes: z.number().int().min(0),
  }),
  scoring: hospitalRecommendationScoringSchema,
  match: z.object({
    meetsRequirements: z.boolean(),
    missingCapabilities: z.array(z.string()),
    warnings: z.array(z.string()),
  }),
  recommendation: hospitalRecommendationLevelSchema,
});
export type HospitalRecommendation = z.infer<typeof hospitalRecommendationSchema>;

export type HospitalCapacityListResponse = { items: HospitalCapacity[] };
export type HospitalRecommendationListResponse = { items: HospitalRecommendation[] };
