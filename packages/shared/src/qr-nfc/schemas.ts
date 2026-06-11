import { z } from "zod";

export const reportVerticalSchema = z.enum(["911", "campus", "venue", "hospital", "transit"]);
export const qrNfcReportTypeSchema = z.enum(["anonymous", "identified", "both"]);
export const reportMediumSchema = z.enum(["qr", "nfc", "sms", "direct", "url"]);

export const createQRNFCSchema = z.object({
  agencyId: z.string().min(1).max(128).optional(),
  name: z.string().min(1).max(200),
  description: z.string().max(500).optional(),
  zoneId: z.string().max(128).optional(),
  zoneName: z.string().max(200).optional(),
  vertical: reportVerticalSchema,
  reportType: qrNfcReportTypeSchema,
  nfcEnabled: z.boolean().default(true),
  nfcTagId: z.string().max(128).optional(),
  expiresAt: z.string().datetime().optional(),
});

export const updateQRNFCSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(500).optional(),
  zoneId: z.string().max(128).optional(),
  zoneName: z.string().max(200).optional(),
  nfcEnabled: z.boolean().optional(),
  nfcTagId: z.string().max(128).optional(),
  active: z.boolean().optional(),
});

export const trackEngagementSchema = z.object({
  medium: z.enum(["qr", "nfc", "direct", "url"]),
});

export const publicReportSubmitSchema = z.object({
  qrId: z.string().min(1).max(64),
  message: z.string().min(1).max(1000),
  locationNote: z.string().max(200).optional(),
  reporterName: z.string().max(120).optional(),
  reporterPhone: z.string().max(32).optional(),
  medium: reportMediumSchema,
  mediaKeys: z.array(z.string().min(1).max(256)).max(5).optional(),
});
