import { z } from "zod";

export const smsRoutingVerticalSchema = z.enum(["campus", "venue", "911", "hospital", "transit"]);

export const createSmsRoutingBodySchema = z.object({
  phoneNumber: z.string().min(8).max(20),
  agencyId: z.string().min(1).max(64),
  vertical: smsRoutingVerticalSchema,
  agencyName: z.string().min(1).max(120),
  label: z.string().min(1).max(120).default("Main reporting line"),
});

export const patchSmsRoutingBodySchema = z.object({
  label: z.string().min(1).max(120).optional(),
  active: z.boolean().optional(),
  agencyName: z.string().min(1).max(120).optional(),
});
