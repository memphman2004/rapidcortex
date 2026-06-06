import { z } from "zod";

export const hl7DepartmentSchema = z.enum([
  "er",
  "icu",
  "trauma",
  "ob",
  "psychiatric",
  "general",
]);
export type Hl7Department = z.infer<typeof hl7DepartmentSchema>;

export const hl7PatientEventSchema = z.enum(["admit", "discharge", "transfer"]);
export type Hl7PatientEvent = z.infer<typeof hl7PatientEventSchema>;

/** Parsed ADT message fields used for bed-count aggregation. */
export const hl7ParsedAdtMessageSchema = z.object({
  messageType: z.string().min(1).max(80),
  messageControlId: z.string().max(80).optional(),
  timestamp: z.string().min(8).max(32),
  sendingFacility: z.string().min(1).max(120),
  eventCode: z.string().min(1).max(10),
  event: hl7PatientEventSchema,
  department: hl7DepartmentSchema,
  bedId: z.string().max(80).optional(),
  rawSegmentCount: z.number().int().min(1),
});
export type Hl7ParsedAdtMessage = z.infer<typeof hl7ParsedAdtMessageSchema>;

export const hl7FacilityBedTotalsSchema = z.object({
  er: z.number().int().min(0).default(25),
  icu: z.number().int().min(0).default(12),
  trauma: z.number().int().min(0).default(4),
});
export type Hl7FacilityBedTotals = z.infer<typeof hl7FacilityBedTotalsSchema>;

export const hl7FacilityMappingEntrySchema = z.object({
  agencyId: z.string().min(1).max(120),
  hospitalId: z.string().min(1).max(120),
  bedTotals: hl7FacilityBedTotalsSchema.optional(),
});
export type Hl7FacilityMappingEntry = z.infer<typeof hl7FacilityMappingEntrySchema>;

export const hl7FacilityMapSchema = z.record(z.string(), hl7FacilityMappingEntrySchema);
export type Hl7FacilityMap = z.infer<typeof hl7FacilityMapSchema>;
