import { z } from "zod";
import { BIOGRAPHY_MAX_LENGTH, normalizeWebsite } from "./domain.js";

function isHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export const RESERVED_SLUGS = new Set(["admin", "api", "c", "card", "revoked", "inactive", "public", "null"]);

export const SlugSchema = z
  .string()
  .min(3)
  .max(60)
  .regex(/^[a-z0-9-]+$/)
  .refine((slug) => !RESERVED_SLUGS.has(slug), "Reserved slug");

const PhoneSchema = z.object({
  type: z.enum(["mobile", "office", "sms", "fax"]),
  number: z.string().regex(/^\+[1-9]\d{1,14}$/),
  extension: z.string().max(12).optional(),
  public: z.boolean(),
});

const EmailSchema = z.object({
  type: z.enum(["primary", "secondary"]),
  address: z.string().email(),
  public: z.boolean(),
});

const LinkSchema = z.object({
  type: z.enum(["linkedin", "website", "calendar", "custom"]),
  label: z.string().max(40).optional(),
  url: z.string().url().startsWith("https://"),
  public: z.boolean(),
});

export const DraftSchema = z.object({
  version: z.number().int().nonnegative().optional(),
  slug: SlugSchema.optional(),
  firstName: z.string().max(80).optional(),
  lastName: z.string().max(80).optional(),
  displayName: z.string().min(1).max(120).optional(),
  credentials: z.string().max(80).optional(),
  title: z.string().max(120).optional(),
  department: z.string().max(120).optional(),
  companyName: z.string().max(160).optional(),
  biography: z.string().max(BIOGRAPHY_MAX_LENGTH).optional(),
  phoneNumbers: z.array(PhoneSchema).max(8).optional(),
  emailAddresses: z.array(EmailSchema).max(4).optional(),
  website: z
    .string()
    .transform((value) => normalizeWebsite(value))
    .refine((value) => value === "" || isHttpUrl(value), {
      message: "Website must be a web address, such as https://www.nexcortiq.com.",
    })
    .optional(),
  officeAddress: z
    .object({
      street: z.string().max(120).optional(),
      city: z.string().max(80).optional(),
      state: z.string().max(40).optional(),
      postalCode: z.string().max(20).optional(),
      country: z.string().max(80).optional(),
      public: z.boolean(),
    })
    .optional(),
  socialLinks: z.array(LinkSchema).max(8).optional(),
  cardTheme: z.enum(["navy", "gold", "slate", "midnight"]).optional(),
  backgroundColor: z.union([z.string().regex(/^#[0-9A-Fa-f]{6}$/), z.literal("")]).optional(),
  accentColor: z.union([z.string().regex(/^#[0-9A-Fa-f]{6}$/), z.literal("")]).optional(),
  photoFocusX: z.number().min(0).max(100).optional(),
  photoFocusY: z.number().min(0).max(100).optional(),
  visibilitySettings: z.record(z.string(), z.boolean()).optional(),
  internalNotes: z.string().max(500).optional(),
  cognitoUserId: z.string().min(1).max(128).optional(),
});

export const PhotoSchema = z.object({
  contentType: z.enum(["image/jpeg", "image/png", "image/webp"]),
  contentLength: z.number().int().positive().max(5_000_000),
  purpose: z.enum(["profile", "cover"]).optional(),
});

export const StatusSchema = z.object({
  status: z.enum(["active", "inactive", "archived"]),
  reason: z.string().max(280).optional(),
  version: z.number().int().positive(),
});

export const LocksSchema = z.object({
  lockedFields: z.array(z.string().max(40)).max(40),
  version: z.number().int().positive(),
});

export const SettingsSchema = z.object({
  enabled: z.boolean().optional(),
  defaultVisibility: z.record(z.string(), z.boolean()).optional(),
  lockedFields: z.array(z.string().max(40)).max(40).optional(),
  defaultTheme: z.enum(["navy", "gold", "slate", "midnight"]).optional(),
  requireSetup: z.boolean().optional(),
  companyWebsite: z
    .string()
    .transform((value) => normalizeWebsite(value))
    .refine((value) => value === "" || isHttpUrl(value), {
      message: "Company website must be a web address, such as https://www.nexcortiq.com.",
    })
    .optional(),
  version: z.number().int().nonnegative().optional(),
});

export const CreateCardSchema = z.object({
  tagType: z.enum(["NTAG213", "NTAG215", "NTAG216", "other"]),
});

export const AssignCardSchema = z.object({
  profileId: z.string().uuid(),
  version: z.number().int().positive(),
});

export const CardStatusSchema = z.object({
  status: z.enum(["unassigned", "assigned", "programmed", "verified"]),
  version: z.number().int().positive(),
});

export const RevokeCardSchema = z.object({
  reason: z.string().min(1).max(280),
  version: z.number().int().positive(),
});

export const EventSchema = z.object({
  eventType: z.enum([
    "page_view",
    "vcf_download",
    "call_click",
    "email_click",
    "web_click",
    "linkedin_click",
    "calendar_click",
    "share_click",
  ]),
  sourceType: z.enum(["nfc", "qr", "direct_link", "shared_link", "unknown"]).default("unknown"),
  cardId: z.string().uuid().optional(),
});
