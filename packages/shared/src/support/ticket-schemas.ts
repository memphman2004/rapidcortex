import { z } from "zod";
import {
  SUPPORT_CATEGORIES,
  SUPPORT_CHANNELS,
  TICKET_SEVERITIES,
  TICKET_STATUSES,
} from "./ticket-types.js";

export const supportChannelSchema = z.enum(SUPPORT_CHANNELS);
export const ticketStatusSchema = z.enum(TICKET_STATUSES);
export const ticketSeveritySchema = z.enum(TICKET_SEVERITIES);
export const supportCategorySchema = z.enum(SUPPORT_CATEGORIES);

export const submitTicketBodySchema = z.object({
  category: supportCategorySchema,
  severity: ticketSeveritySchema,
  subject: z.string().trim().min(1).max(120),
  description: z.string().trim().min(1).max(8000),
  currentPageUrl: z.string().trim().max(2000).optional(),
  userAgent: z.string().trim().max(1000).optional(),
  agencyName: z.string().trim().max(200).optional(),
});

export const patchSupportTicketBodySchema = z
  .object({
    status: ticketStatusSchema.optional(),
    severity: ticketSeveritySchema.optional(),
    category: supportCategorySchema.optional(),
    subject: z.string().trim().min(1).max(120).optional(),
    assignedToUserId: z.string().trim().max(128).optional(),
    assignedToName: z.string().trim().max(200).optional(),
    note: z.string().trim().max(4000).optional(),
    resolutionNotes: z.string().trim().max(4000).optional(),
    reopenReason: z.string().trim().max(4000).optional(),
  })
  .refine((v) => Object.values(v).some((x) => x !== undefined && x !== ""), {
    message: "At least one field is required",
  });

export const addSupportTicketNoteBodySchema = z.object({
  text: z.string().trim().min(1).max(4000),
});
