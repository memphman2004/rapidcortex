import { z } from "zod";
import { normalizePhoneE164 } from "../lib/phone-format.js";

export const reportVerticalSchema = z.enum(["911", "campus", "venue", "hospital", "transit"]);
export const qrNfcReportTypeSchema = z.enum(["anonymous", "identified", "both"]);
export const reportMediumSchema = z.enum(["qr", "nfc", "sms", "direct", "url"]);

const e164PhoneSchema = z
  .string()
  .trim()
  .regex(/^\+[1-9]\d{6,14}$/, "Phone must be E.164 format (e.g. +17065551234)");

function preprocessOptionalCallNumber(val: unknown): unknown {
  if (val === undefined || val === null || val === "") return undefined;
  if (typeof val !== "string") return val;
  const trimmed = val.trim();
  if (!trimmed) return undefined;
  return normalizePhoneE164(trimmed);
}

const optionalCallNumberSchema = z.preprocess(
  preprocessOptionalCallNumber,
  e164PhoneSchema.optional(),
);

export const createQRNFCSchema = z.object({
  agencyId: z.string().min(1).max(128).optional(),
  name: z.string().min(1).max(200),
  description: z.string().max(500).optional(),
  zoneId: z.string().max(128).optional(),
  zoneName: z.string().max(200).optional(),
  buildingId: z.string().max(50).optional(),
  floor: z.string().max(16).optional(),
  cameraIds: z.array(z.string().min(1).max(64)).max(8).optional(),
  siteCode: z.string().trim().max(20).optional(),
  vertical: reportVerticalSchema,
  reportType: qrNfcReportTypeSchema,
  nfcEnabled: z.boolean().default(true),
  nfcTagId: z.string().max(128).optional(),
  expiresAt: z.string().datetime().optional(),
  callNumber: optionalCallNumberSchema,
});

export const updateQRNFCSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(500).optional(),
  zoneId: z.string().max(128).optional(),
  zoneName: z.string().max(200).optional(),
  buildingId: z.string().max(50).optional(),
  floor: z.string().max(16).optional(),
  cameraIds: z.array(z.string().min(1).max(64)).max(8).optional(),
  siteCode: z.string().trim().max(20).optional(),
  nfcEnabled: z.boolean().optional(),
  nfcTagId: z.string().max(128).optional(),
  active: z.boolean().optional(),
  callNumber: optionalCallNumberSchema,
});

export const trackEngagementSchema = z.object({
  medium: z.enum(["qr", "nfc", "direct", "url"]),
});

export const tradeShowSiteUsageItemSchema = z.object({
  qrId: z.enum(["site-home", "site-demo"]),
  destinationId: z.enum(["home", "demo"]),
  name: z.string(),
  url: z.string(),
  scanCount: z.number().nonnegative(),
  nfcTapCount: z.number().nonnegative(),
  totalEngagements: z.number().nonnegative(),
  lastEngagementAt: z.string().optional(),
});

export const tradeShowSiteUsageResponseSchema = z.object({
  items: z.array(tradeShowSiteUsageItemSchema),
});

export type TradeShowSiteUsageItem = z.infer<typeof tradeShowSiteUsageItemSchema>;
export type TradeShowSiteUsageResponse = z.infer<typeof tradeShowSiteUsageResponseSchema>;

export const publicReportSubmitSchema = z.object({
  qrId: z.string().min(1).max(64),
  message: z.string().min(1).max(1000),
  locationNote: z.string().max(200).optional(),
  reporterName: z.string().max(120).optional(),
  reporterPhone: z.string().max(32).optional(),
  medium: reportMediumSchema,
  mediaKeys: z.array(z.string().min(1).max(256)).max(5).optional(),
});
