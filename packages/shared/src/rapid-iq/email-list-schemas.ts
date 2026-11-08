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
export const EMAIL_LIST_VERTICALS = [
  "PSAP",
  "LAW_ENFORCEMENT",
  "FIRE_EMS",
  "CAMPUS",
  "VENUE",
  "HOSPITAL",
  "TRANSIT",
] as const;
export type EmailListVertical = (typeof EMAIL_LIST_VERTICALS)[number];

export const EMAIL_LIST_SOURCES = [
  "manual",
  "psap_prospect",
  "sales_lead",
  "rapid_iq_contact",
  "apollo",
  "import",
] as const;
export type EmailListSource = (typeof EMAIL_LIST_SOURCES)[number];

export const emailListVerticalSchema = z.enum(EMAIL_LIST_VERTICALS);

export const emailListEntrySchema = z.object({
  email: z.string().trim().email().max(200),
  vertical: emailListVerticalSchema,
  name: z.string().trim().max(200).optional(),
  /** Agency / company / PSAP name for campaign export and list UI. */
  agencyName: z.string().trim().max(300).optional(),
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
    agencyName: z.string().trim().max(300).optional(),
    source: z.enum(EMAIL_LIST_SOURCES).optional().default("manual"),
    psapId: z.string().trim().max(128).optional(),
  })
  .strict();
export type AddEmailListEntryBody = z.infer<typeof addEmailListEntryBodySchema>;

export const emailListQuerySchema = z.object({
  vertical: emailListVerticalSchema.optional(),
});

export const emailListImportRowSchema = z.object({
  email: z.string().trim().email().max(200),
  vertical: emailListVerticalSchema,
  firstName: z.string().trim().max(100).optional(),
  lastName: z.string().trim().max(100).optional(),
  title: z.string().trim().max(200).optional(),
  agencyName: z.string().trim().max(300).optional(),
  state: z.string().trim().max(80).optional(),
  name: z.string().trim().max(200).optional(),
});
export type EmailListImportRow = z.infer<typeof emailListImportRowSchema>;

export const emailListImportBodySchema = z
  .object({
    rows: z.array(emailListImportRowSchema).min(1).max(5000),
    /** Defaults to import; use apollo for Apollo CSV / sync-style uploads. */
    source: z.enum(EMAIL_LIST_SOURCES).optional().default("import"),
  })
  .strict();
export type EmailListImportBody = z.infer<typeof emailListImportBodySchema>;

export const emailListApolloSyncBodySchema = z
  .object({
    vertical: emailListVerticalSchema,
    forceRefresh: z.boolean().optional().default(false),
  })
  .strict();
export type EmailListApolloSyncBody = z.infer<typeof emailListApolloSyncBodySchema>;

/** Move an existing list membership from one vertical partition to another. */
export const moveEmailListEntryBodySchema = z
  .object({
    email: z.string().trim().email().max(200),
    fromVertical: emailListVerticalSchema,
    vertical: emailListVerticalSchema,
  })
  .strict()
  .refine((b) => b.fromVertical !== b.vertical, {
    message: "vertical must differ from fromVertical",
    path: ["vertical"],
  });
export type MoveEmailListEntryBody = z.infer<typeof moveEmailListEntryBodySchema>;

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
