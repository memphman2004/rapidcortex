import { z } from "zod";
import { hospitalCapacitySchema, hospitalDiversionTypeSchema } from "./schemas.js";
import { HOSPITAL_ASSIGNABLE_ROLES } from "../auth/rapid-cortex-roles.js";

export const manualCapacityBedInputSchema = z.object({
  available: z.number().int().min(0),
  total: z.number().int().min(0),
});

export const manualCapacityUpdateBodySchema = z
  .object({
    erBeds: manualCapacityBedInputSchema,
    icuBeds: manualCapacityBedInputSchema,
    traumaBeds: manualCapacityBedInputSchema.optional(),
    waitTimeMinutes: z.number().int().min(0).max(300),
    isOnDiversion: z.boolean(),
    diversionType: hospitalDiversionTypeSchema.optional(),
    diversionReason: z.string().max(200).optional(),
    staffing: z.object({
      erPhysicians: z.number().int().min(0),
      erNurses: z.number().int().min(0),
      adequateStaffing: z.boolean(),
    }),
    notes: z.string().max(500).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.erBeds.available > data.erBeds.total) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Available ER beds cannot exceed total",
        path: ["erBeds", "available"],
      });
    }
    if (data.icuBeds.available > data.icuBeds.total) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Available ICU beds cannot exceed total",
        path: ["icuBeds", "available"],
      });
    }
    if (data.traumaBeds && data.traumaBeds.available > data.traumaBeds.total) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Available trauma beds cannot exceed total",
        path: ["traumaBeds", "available"],
      });
    }
    if (data.isOnDiversion && !data.diversionReason?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Diversion reason is required when on diversion",
        path: ["diversionReason"],
      });
    }
    if (data.isOnDiversion && !data.diversionType) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Diversion type is required when on diversion",
        path: ["diversionType"],
      });
    }
  });

export type ManualCapacityUpdateBody = z.infer<typeof manualCapacityUpdateBodySchema>;

export const registerHospitalUserBodySchema = z.object({
  email: z.string().email().max(254),
  hospitalId: z.string().min(1).max(120),
  role: z.enum(HOSPITAL_ASSIGNABLE_ROLES),
  firstName: z.string().min(1).max(80),
  lastName: z.string().min(1).max(80),
});

export type RegisterHospitalUserBody = z.infer<typeof registerHospitalUserBodySchema>;

export const hospitalPortalContextSchema = z.object({
  hospital: z.object({
    hospitalId: z.string(),
    name: z.string(),
    traumaLevel: z.string().optional(),
    pediatricCapable: z.boolean(),
  }),
  capacity: hospitalCapacitySchema.nullable(),
});

export type HospitalPortalContext = z.infer<typeof hospitalPortalContextSchema>;
