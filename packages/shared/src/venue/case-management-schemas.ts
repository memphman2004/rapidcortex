import { z } from "zod";

/** Full case lifecycle for venue digital incident reporting (RFP 2396IP). */
export const venueCaseStatusSchema = z.enum([
  "open",
  "assigned",
  "responding",
  "pending_approval",
  "approved",
  "resolved",
  "closed",
  "escalated",
  "reopened",
]);

export type VenueCaseStatus = z.infer<typeof venueCaseStatusSchema>;

export const venueCaseActionSchema = z.enum([
  "assign",
  "investigate",
  "link",
  "escalate",
  "submit_for_approval",
  "approve",
  "reject",
  "close",
  "reopen",
  "update_fields",
]);

export type VenueCaseAction = z.infer<typeof venueCaseActionSchema>;

export const venueCaseActionBodySchema = z
  .object({
    action: venueCaseActionSchema,
    assigneeId: z.string().trim().min(1).max(128).optional(),
    assigneeLabel: z.string().trim().min(1).max(200).optional(),
    linkedIncidentId: z.string().trim().min(1).max(128).optional(),
    note: z.string().trim().max(4000).optional(),
    severity: z.enum(["low", "medium", "high", "critical"]).optional(),
    category: z.string().trim().max(64).optional(),
    fields: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])).optional(),
  })
  .strict()
  .superRefine((v, ctx) => {
    if (v.action === "assign" && !v.assigneeId?.trim()) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "assigneeId required", path: ["assigneeId"] });
    }
    if (v.action === "link" && !v.linkedIncidentId?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "linkedIncidentId required",
        path: ["linkedIncidentId"],
      });
    }
  });

export type VenueCaseActionBody = z.infer<typeof venueCaseActionBodySchema>;

export const venueEvidenceUploadBodySchema = z.object({
  fileName: z.string().trim().min(1).max(256),
  contentType: z.string().trim().min(3).max(128),
  byteSize: z.number().int().positive().max(100 * 1024 * 1024),
  sha256: z
    .string()
    .trim()
    .regex(/^[a-f0-9]{64}$/i, "sha256 must be 64 hex chars"),
  kind: z.enum(["photo", "video", "document", "statement", "other"]).default("photo"),
  label: z.string().trim().max(200).optional(),
});

export type VenueEvidenceUploadBody = z.infer<typeof venueEvidenceUploadBodySchema>;

export const venueEvidenceConfirmBodySchema = z.object({
  evidenceId: z.string().trim().min(1),
  s3Key: z.string().trim().min(1),
  sha256: z
    .string()
    .trim()
    .regex(/^[a-f0-9]{64}$/i),
});

export type VenueEvidenceConfirmBody = z.infer<typeof venueEvidenceConfirmBodySchema>;

export const venueCustodyTransferBodySchema = z.object({
  evidenceId: z.string().trim().min(1),
  toCustodianId: z.string().trim().min(1).max(128),
  toCustodianLabel: z.string().trim().min(1).max(200),
  reason: z.string().trim().min(1).max(1000),
});

export type VenueCustodyTransferBody = z.infer<typeof venueCustodyTransferBodySchema>;

export const venueSecureShareBodySchema = z.object({
  recipientEmail: z.string().email().optional(),
  recipientLabel: z.string().trim().max(200).optional(),
  ttlHours: z.number().int().min(1).max(168).default(72),
  includeAttachments: z.boolean().default(true),
  note: z.string().trim().max(1000).optional(),
});

export type VenueSecureShareBody = z.infer<typeof venueSecureShareBodySchema>;

export const venueFormFieldSchema = z.object({
  id: z.string().trim().min(1).max(64),
  label: z.string().trim().min(1).max(200),
  type: z.enum(["text", "textarea", "select", "number", "boolean", "datetime", "phone"]),
  required: z.boolean().default(false),
  options: z.array(z.string().trim().min(1).max(100)).max(50).optional(),
  category: z.string().trim().max(64).optional(),
  sortOrder: z.number().int().min(0).max(999).default(0),
});

export const venueFormSchemaConfigSchema = z.object({
  version: z.number().int().positive(),
  categories: z.array(z.string().trim().min(1).max(64)).max(40),
  severities: z.array(z.enum(["low", "medium", "high", "critical"])).min(1),
  fields: z.array(venueFormFieldSchema).max(80),
  approvalRequired: z.boolean().default(true),
  updatedAt: z.string().datetime().optional(),
  updatedBy: z.string().optional(),
});

export type VenueFormSchemaConfig = z.infer<typeof venueFormSchemaConfigSchema>;

export const venueFormSchemaPutBodySchema = venueFormSchemaConfigSchema
  .omit({ updatedAt: true, updatedBy: true })
  .strict();

export type VenueFormSchemaPutBody = z.infer<typeof venueFormSchemaPutBodySchema>;

export const venueIntegrationImportBodySchema = z.object({
  source: z.enum(["employee_directory", "event_schedule", "csv_upload"]),
  records: z
    .array(
      z.object({
        externalId: z.string().trim().min(1).max(128),
        type: z.enum(["employee", "event"]),
        displayName: z.string().trim().min(1).max(200),
        email: z.string().email().optional(),
        department: z.string().trim().max(128).optional(),
        eventStart: z.string().datetime().optional(),
        eventEnd: z.string().datetime().optional(),
        expectedAttendance: z.number().int().nonnegative().optional(),
        metadata: z.record(z.string(), z.string()).optional(),
      }),
    )
    .min(1)
    .max(500),
  dryRun: z.boolean().default(false),
});

export type VenueIntegrationImportBody = z.infer<typeof venueIntegrationImportBodySchema>;

export const DEFAULT_VENUE_FORM_SCHEMA: VenueFormSchemaConfig = {
  version: 1,
  categories: [
    "security",
    "medical",
    "lost_person",
    "maintenance",
    "guest_services",
    "fire_life_safety",
    "other",
  ],
  severities: ["low", "medium", "high", "critical"],
  approvalRequired: true,
  fields: [
    {
      id: "location_detail",
      label: "Specific location / booth",
      type: "text",
      required: true,
      sortOrder: 1,
    },
    {
      id: "witness_names",
      label: "Witness names",
      type: "textarea",
      required: false,
      sortOrder: 2,
    },
    {
      id: "injuries",
      label: "Injuries reported",
      type: "boolean",
      required: false,
      sortOrder: 3,
    },
    {
      id: "police_notified",
      label: "Police / EMS notified",
      type: "boolean",
      required: false,
      sortOrder: 4,
    },
    {
      id: "disposition",
      label: "Disposition notes",
      type: "textarea",
      required: false,
      sortOrder: 5,
    },
  ],
};
