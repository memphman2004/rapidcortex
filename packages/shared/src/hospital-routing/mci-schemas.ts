import { z } from "zod";
import { hospitalPatientNeedsSchema } from "./schemas.js";

export const mciTriagePrioritySchema = z.enum(["IMMEDIATE", "DELAYED", "MINIMAL", "EXPECTANT"]);
export type MciTriagePriority = z.infer<typeof mciTriagePrioritySchema>;

export const mciPatientSchema = z.object({
  patientId: z.string().min(1).max(80),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  priority: mciTriagePrioritySchema,
  needs: hospitalPatientNeedsSchema.optional(),
});
export type MciPatient = z.infer<typeof mciPatientSchema>;

export const mciIncidentSchema = z.object({
  incidentId: z.string().min(1).max(120),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  patients: z.array(mciPatientSchema).min(1).max(200),
});
export type MciIncident = z.infer<typeof mciIncidentSchema>;

export const mciHospitalAllocationSchema = z.object({
  hospitalId: z.string(),
  hospitalName: z.string(),
  latitude: z.number(),
  longitude: z.number(),
  traumaLevel: z.string().optional(),
  assignedPatientIds: z.array(z.string()),
  currentLoad: z.number().int().min(0),
  availableCapacity: z.number().int(),
  reasoning: z.string(),
});
export type MciHospitalAllocation = z.infer<typeof mciHospitalAllocationSchema>;

export const mciDistributionPlanSchema = z.object({
  planId: z.string(),
  agencyId: z.string(),
  incidentId: z.string(),
  status: z.enum(["DRAFT", "ACTIVE", "CANCELLED"]),
  totalPatients: z.number().int().min(0),
  allocations: z.array(mciHospitalAllocationSchema),
  unallocatedPatientIds: z.array(z.string()),
  patients: z.array(mciPatientSchema),
  summary: z.object({
    hospitalsUsed: z.number().int().min(0),
    avgPatientsPerHospital: z.number(),
    maxHospitalLoad: z.number().int().min(0),
    allocationTimeMs: z.number().int().min(0),
  }),
  warnings: z.array(z.string()),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type MciDistributionPlan = z.infer<typeof mciDistributionPlanSchema>;

export const createMciPlanBodySchema = mciIncidentSchema;
export type CreateMciPlanBody = z.infer<typeof createMciPlanBodySchema>;
