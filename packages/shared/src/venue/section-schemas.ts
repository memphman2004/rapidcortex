import { z } from "zod";

export const venueSectionLevelSchema = z.enum(["lower", "club", "upper", "suite"]);
export type VenueSectionLevel = z.infer<typeof venueSectionLevelSchema>;

export const venueSectionStatusSchema = z.enum(["clear", "elevated", "incident", "closed"]);
export type VenueSectionStatus = z.infer<typeof venueSectionStatusSchema>;

export const venueTypeSchema = z.enum([
  "stadium",
  "arena",
  "theater",
  "convention_center",
  "amphitheater",
]);
export type VenueType = z.infer<typeof venueTypeSchema>;

export const venueSectionSchema = z.object({
  id: z.string().trim().min(1),
  label: z.string().trim().min(1).max(32),
  level: venueSectionLevelSchema,
  capacity: z.number().int().min(0).max(100_000),
  zone: z.string().trim().min(1).max(64),
  svgX: z.number().min(0).max(260),
  svgY: z.number().min(0).max(148),
  status: venueSectionStatusSchema,
  notes: z.string().max(2000).optional(),
  assignedOfficer: z.string().max(120).optional(),
  updatedAt: z.string().datetime(),
});

export type VenueSection = z.infer<typeof venueSectionSchema>;

export const venueSectionUpsertBodySchema = venueSectionSchema.omit({ updatedAt: true }).extend({
  updatedAt: z.string().datetime().optional(),
});

export type VenueSectionUpsertBody = z.infer<typeof venueSectionUpsertBodySchema>;

export const venueSectionStatusPatchSchema = z.object({
  status: venueSectionStatusSchema,
  notes: z.string().max(2000).optional(),
  assignedOfficer: z.string().max(120).optional(),
});

export type VenueSectionStatusPatch = z.infer<typeof venueSectionStatusPatchSchema>;

export const venueProfileSchema = z.object({
  venueCode: z.string().trim().min(1),
  venueName: z.string().trim().min(1).max(200),
  venueType: venueTypeSchema.optional(),
  capacity: z.number().int().min(0).max(500_000).optional(),
  levels: z.array(venueSectionLevelSchema).max(8).optional(),
  gateCount: z.number().int().min(0).max(200).optional(),
  city: z.string().max(120).optional(),
  state: z.string().max(8).optional(),
  timezone: z.string().max(64).optional(),
  active: z.boolean().optional(),
  smsEnabled: z.boolean().optional(),
  qrEnabled: z.boolean().optional(),
  /** Guest QR/SMS intake may attach still images. */
  photoUploadsEnabled: z.boolean().optional(),
  /** Guest QR/SMS intake may attach short video clips. */
  videoUploadsEnabled: z.boolean().optional(),
});

export type VenueProfile = z.infer<typeof venueProfileSchema>;

export const venueProfilePatchSchema = venueProfileSchema
  .omit({ venueCode: true })
  .partial()
  .refine((body) => Object.keys(body).length > 0, { message: "At least one field is required" });

export type VenueProfilePatch = z.infer<typeof venueProfilePatchSchema>;
