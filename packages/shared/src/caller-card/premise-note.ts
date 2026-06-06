import { z } from "zod";

export const premiseHazardTypeSchema = z.enum([
  "weapons",
  "dogs",
  "mental_health",
  "hazmat",
  "violent_history",
  "other",
]);

export type PremiseHazardType = z.infer<typeof premiseHazardTypeSchema>;

/** Persisted premise note (Dynamo). */
export const premiseNoteRecordSchema = z.object({
  noteId: z.string().min(8).max(120),
  agencyId: z.string().min(2).max(64),
  /** Same as caller address index key; `agencyId#normalized` for partition. */
  normalizedAddress: z.string().min(1).max(520),
  incidentId: z.string().min(4).max(120).optional(),
  text: z.string().min(1).max(12_000),
  createdBy: z.string().min(1).max(120),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1).optional(),
  hazardType: premiseHazardTypeSchema.nullable().optional(),
  isHazard: z.boolean().optional(),
  knownOccupants: z.string().max(2000).optional(),
  specialInstructions: z.string().max(5000).optional(),
});

export type PremiseNoteRecord = z.infer<typeof premiseNoteRecordSchema>;

export const createPremiseNoteRequestSchema = z.object({
  text: z.string().min(1).max(12_000),
  hazardType: premiseHazardTypeSchema.nullable().optional(),
  isHazard: z.boolean().optional(),
  knownOccupants: z.string().max(2000).optional(),
  specialInstructions: z.string().max(5000).optional(),
});

export type CreatePremiseNoteRequest = z.infer<typeof createPremiseNoteRequestSchema>;

export const patchPremiseNoteRequestSchema = z
  .object({
    text: z.string().min(1).max(12_000).optional(),
    hazardType: premiseHazardTypeSchema.nullable().optional(),
    isHazard: z.boolean().optional(),
    knownOccupants: z.string().max(2000).nullable().optional(),
    specialInstructions: z.string().max(5000).nullable().optional(),
  })
  .refine((b) => Object.keys(b).length > 0, { message: "At least one field is required" });

export type PatchPremiseNoteRequest = z.infer<typeof patchPremiseNoteRequestSchema>;

const premiseNoteResponseItemSchema = z.object({
  noteId: z.string(),
  agencyId: z.string(),
  normalizedAddress: z.string(),
  incidentId: z.string().optional(),
  text: z.string(),
  createdBy: z.string(),
  createdAt: z.string(),
  updatedAt: z.string().optional(),
  hazardType: premiseHazardTypeSchema.nullable().optional(),
  isHazard: z.boolean().optional(),
  knownOccupants: z.string().optional(),
  specialInstructions: z.string().optional(),
});

export const createPremiseNoteResponseSchema = z.object({
  note: premiseNoteResponseItemSchema,
});

export type CreatePremiseNoteResponse = z.infer<typeof createPremiseNoteResponseSchema>;

export const patchPremiseNoteResponseSchema = z.object({
  note: premiseNoteResponseItemSchema,
});

export type PatchPremiseNoteResponse = z.infer<typeof patchPremiseNoteResponseSchema>;
