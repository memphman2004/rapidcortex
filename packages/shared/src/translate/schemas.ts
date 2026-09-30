import { z } from "zod";
import { TRANSLATE_VERTICALS } from "./types.js";

const locationSchema = z.object({
  latitude: z.number().finite(),
  longitude: z.number().finite(),
});

export const translateVenueContextSchema = z.object({
  venueCode: z.string().min(1).max(64),
  venueName: z.string().max(200).optional(),
  venueIncidentId: z.string().max(128).optional(),
  sectionCode: z.string().max(64).optional(),
  sectionLabel: z.string().max(200).optional(),
});

export const translateCampusContextSchema = z.object({
  campusCode: z.string().min(1).max(64),
  campusName: z.string().max(200).optional(),
  campusIncidentId: z.string().max(128).optional(),
  buildingCode: z.string().max(64).optional(),
  buildingLabel: z.string().max(200).optional(),
});

export const translateHospitalContextSchema = z.object({
  hospitalId: z.string().min(1).max(64),
  hospitalName: z.string().max(200).optional(),
  patientEncounterId: z.string().max(128).optional(),
  departmentCode: z.string().max(64).optional(),
  departmentLabel: z.string().max(200).optional(),
});

export const translateSessionCreateRequestSchema = z.object({
  incidentId: z.string().max(128).optional(),
  subjectLanguage: z.string().max(16).optional(),
  location: locationSchema.optional(),
  vertical: z.enum(TRANSLATE_VERTICALS).optional(),
  venueContext: translateVenueContextSchema.optional(),
  campusContext: translateCampusContextSchema.optional(),
  hospitalContext: translateHospitalContextSchema.optional(),
});

export const translateLinkRequestSchema = z.object({
  incidentId: z.string().max(128).optional(),
  officerPhone: z.string().max(32).optional(),
  officerUserId: z.string().max(128).optional(),
  subjectLanguage: z.string().max(16).optional(),
  vertical: z.enum(TRANSLATE_VERTICALS).optional(),
  venueContext: translateVenueContextSchema.optional(),
  campusContext: translateCampusContextSchema.optional(),
  hospitalContext: translateHospitalContextSchema.optional(),
});

export const translateSessionCloseRequestSchema = z.object({
  cadWriteback: z.boolean().optional(),
  writebackNote: z.boolean().optional(),
  notes: z.string().max(4000).optional(),
});

export const translateAssistanceSummaryQuerySchema = z.object({
  agencyId: z.string().min(1).max(128),
  from: z
    .string()
    .optional()
    .refine((v) => v === undefined || !Number.isNaN(Date.parse(v)), { message: "Invalid from" }),
  to: z
    .string()
    .optional()
    .refine((v) => v === undefined || !Number.isNaN(Date.parse(v)), { message: "Invalid to" }),
});

export const translateAssistanceEncounterSchema = z.object({
  assistanceId: z.string().min(1),
  agencyId: z.string().min(1),
  sessionId: z.string().min(1),
  vertical: z.enum(TRANSLATE_VERTICALS),
  officerId: z.string().min(1),
  officerName: z.string().max(200).optional(),
  subjectLanguage: z.string().max(16),
  primaryLanguage: z.string().max(16),
  startedAt: z.string(),
  endedAt: z.string(),
  durationSec: z.number().int().nonnegative(),
  segmentCount: z.number().int().nonnegative(),
  linkedIncidentId: z.string().max(128).optional(),
  standalone: z.boolean(),
  assistMonth: z.string().regex(/^\d{4}-\d{2}$/),
  createdAt: z.string(),
});
