/**
 * Vertical email / newsletter list membership (Inside iQ monthly).
 * Stored as EMAILLIST#{vertical} / EMAIL#{email} on the pipeline signals table.
 */

import { z } from "zod";
import {
  RAPID_IQ_SALES_VERTICALS,
  normalizeSalesAutomationVertical,
  type RapidIqSalesVertical,
} from "./sales-automation-schemas.js";

/** Product verticals for the list UI (excludes ALL). */
export const EMAIL_LIST_VERTICALS = ["PSAP", "CAMPUS", "VENUE", "HOSPITAL", "TRANSIT"] as const;
export type EmailListVertical = (typeof EMAIL_LIST_VERTICALS)[number];

export const EMAIL_LIST_SOURCES = [
  "manual",
  "psap_prospect",
  "sales_lead",
  "rapid_iq_contact",
] as const;
export type EmailListSource = (typeof EMAIL_LIST_SOURCES)[number];

export const emailListVerticalSchema = z.enum(EMAIL_LIST_VERTICALS);

export const emailListEntrySchema = z.object({
  email: z.string().trim().email().max(200),
  vertical: emailListVerticalSchema,
  name: z.string().trim().max(200).optional(),
  source: z.enum(EMAIL_LIST_SOURCES),
  psapId: z.string().trim().max(128).optional(),
  createdAt: z.string().min(1),
  createdBy: z.string().trim().max(128).optional(),
  unsubscribed: z.boolean().optional(),
});
export type EmailListEntry = z.infer<typeof emailListEntrySchema>;

export const addEmailListEntryBodySchema = z
  .object({
    email: z.string().trim().email().max(200),
    vertical: emailListVerticalSchema,
    name: z.string().trim().max(200).optional(),
    source: z.enum(EMAIL_LIST_SOURCES).optional().default("manual"),
    psapId: z.string().trim().max(128).optional(),
  })
  .strict();
export type AddEmailListEntryBody = z.infer<typeof addEmailListEntryBodySchema>;

export const emailListQuerySchema = z.object({
  vertical: emailListVerticalSchema.optional(),
});

export function normalizeEmailListVertical(raw: unknown): EmailListVertical {
  const v = normalizeSalesAutomationVertical(raw);
  if (v === "ALL") return "PSAP";
  if ((EMAIL_LIST_VERTICALS as readonly string[]).includes(v)) return v as EmailListVertical;
  return "PSAP";
}

export function isEmailListVertical(raw: unknown): raw is EmailListVertical {
  return typeof raw === "string" && (EMAIL_LIST_VERTICALS as readonly string[]).includes(raw);
}

/** Map sales automation vertical (incl. ALL) onto list partition keys. */
export function emailListVerticalsForCampaign(
  vertical: RapidIqSalesVertical,
): EmailListVertical[] {
  if (vertical === "ALL") return [...EMAIL_LIST_VERTICALS];
  if (isEmailListVertical(vertical)) return [vertical];
  return ["PSAP"];
}

export { RAPID_IQ_SALES_VERTICALS };
