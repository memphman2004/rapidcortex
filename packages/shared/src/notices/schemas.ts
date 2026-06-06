import { z } from "zod";

export const noticeTargetTypeSchema = z.enum(["all", "vertical", "agency"]);
export const noticeVerticalSchema = z.enum(["core", "campus", "venue", "hospital"]);
export const noticeSeveritySchema = z.enum(["info", "warning", "critical"]);

export const createNoticeInputSchema = z
  .object({
    targetType: noticeTargetTypeSchema,
    targetVertical: noticeVerticalSchema.optional(),
    targetAgencyId: z.string().min(1).max(128).optional(),
    severity: noticeSeveritySchema,
    title: z.string().min(1).max(120),
    message: z.string().min(1).max(500),
    expiresInHours: z.number().int().min(1).max(168).optional().default(24),
    dismissible: z.boolean().optional().default(true),
    requiresAck: z.boolean().optional().default(false),
  })
  .superRefine((value, ctx) => {
    if (value.targetType === "vertical" && !value.targetVertical) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "targetVertical is required when targetType is vertical",
        path: ["targetVertical"],
      });
    }
    if (value.targetType === "agency" && !value.targetAgencyId?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "targetAgencyId is required when targetType is agency",
        path: ["targetAgencyId"],
      });
    }
  });
