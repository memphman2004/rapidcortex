import { z } from "zod";
import { isValidRCLI } from "./rcli.js";

export const qrLocationVerticalSchema = z.enum(["campus", "venue", "core"]);

export const createQRLocationSchema = z.object({
  locationName: z.string().min(1).max(200),
  building: z.string().min(1).max(200),
  floor: z.string().max(100).optional(),
  zone: z.string().max(200).optional(),
  zoneCode: z
    .string()
    .min(3)
    .max(16)
    .regex(/^RC\d{3,}$/i, "Zone code must look like RC101")
    .transform((s) => s.toUpperCase()),
  orgCode: z
    .string()
    .min(2)
    .max(8)
    .regex(/^[A-Za-z0-9]+$/)
    .transform((s) => s.toUpperCase()),
  vertical: qrLocationVerticalSchema,
  lat: z.number().finite().optional(),
  lng: z.number().finite().optional(),
  active: z.boolean().optional().default(true),
});

export const updateQRLocationSchema = createQRLocationSchema
  .partial()
  .extend({
    active: z.boolean().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "At least one field required" });

export const qrLocationBulkRowSchema = z.object({
  locationName: z.string().min(1).max(200),
  building: z.string().min(1).max(200),
  floor: z.string().max(100).optional().default(""),
  zone: z.string().max(200).optional().default(""),
  zoneCode: z
    .string()
    .min(3)
    .max(16)
    .regex(/^RC\d{3,}$/i)
    .transform((s) => s.toUpperCase()),
  lat: z.coerce.number().finite().optional(),
  lng: z.coerce.number().finite().optional(),
});

export const qrPublicIntakeSchema = z.object({
  helpType: z.enum(["safety", "medical", "suspicious", "other"]),
  description: z.string().max(2000).optional().default(""),
  mediaKeys: z.array(z.string().max(500)).max(10).optional().default([]),
  photoDataUrl: z.string().max(5_000_000).optional().nullable(),
  videoDataUrl: z.string().max(5_000_000).optional().nullable(),
  shareLiveLocation: z.boolean().optional().default(false),
  lat: z.number().finite().optional().nullable(),
  lng: z.number().finite().optional().nullable(),
  isAnonymous: z.boolean().optional().default(true),
  reporterName: z.string().max(120).optional().nullable(),
  reporterPhone: z.string().max(40).optional().nullable(),
  reporterEmail: z.string().email().max(200).optional().nullable(),
  preferredLanguage: z.string().max(16).optional().nullable(),
});

export const rcliParamSchema = z
  .string()
  .transform((s) => s.trim().toUpperCase())
  .refine(isValidRCLI, { message: "Invalid RCLI format" });
