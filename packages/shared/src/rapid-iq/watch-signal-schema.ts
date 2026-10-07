/**
 * Canonical ChatGPT Watch → NexiQ Watch Inbox contract (one signal per POST).
 * Discovery ≠ Lead — humans qualify before CRM.
 */

import { z } from "zod";

export const WATCH_SIGNAL_WATCHES = [
  "psap_intelligence",
  "campus_intelligence",
  "venue_intelligence",
  "transit_intelligence",
  "competitor_intelligence",
  "cross_vertical",
] as const;

export const WATCH_SIGNAL_PRIMARY_VERTICALS = [
  "psap",
  "campus",
  "venue",
  "transit",
  "law_enforcement",
  "rtcc",
  "competitor",
  "cross_vertical",
] as const;

export const WATCH_SIGNAL_TYPES = [
  "procurement",
  "evaluation",
  "planning",
  "funded",
  "pain_signal",
  "competitor_activity",
  "renewal",
  "implementation",
  "award",
  "early_signal",
] as const;

export const WATCH_SIGNAL_STRENGTHS = ["weak", "moderate", "strong", "confirmed"] as const;

export const WATCH_SIGNAL_BUYING_STAGES = [
  "awareness",
  "planning",
  "funded",
  "evaluating",
  "procurement_live",
  "award_pending",
  "implementation",
  "renewal",
  "closed",
] as const;

export const WATCH_SIGNAL_LIFECYCLE_CHANGES = [
  "new",
  "deadline_change",
  "addendum",
  "qa",
  "budget_change",
  "vendor_demo",
  "vendor_selected",
  "contract_renewal",
  "scope_change",
  "contact_change",
  "cancel",
  "award",
  "implementation",
  "none",
] as const;

export const WATCH_SIGNAL_SOURCE_QUALITIES = [
  "authoritative",
  "strong",
  "secondary",
  "unverified",
] as const;

export const WATCH_SIGNAL_PRIORITY_LABELS = ["URGENT", "HIGH", "MEDIUM", "LOW"] as const;

const nullableString = (max: number) => z.string().max(max).nullable();

export const watchSignalEvidenceSchema = z.object({
  url: z.string().url().max(2000),
  source_type: z.string().min(1).max(80),
  source_quality: z.enum(WATCH_SIGNAL_SOURCE_QUALITIES),
  document_title: nullableString(500),
  page: z.union([z.string().max(80), z.number(), z.null()]),
  meeting_date: nullableString(32),
});

export const watchSignalSchema = z.object({
  source: z.literal("chatgpt_watch"),
  watch: z.enum(WATCH_SIGNAL_WATCHES),
  external_key: z.string().min(3).max(300),
  primary_vertical: z.enum(WATCH_SIGNAL_PRIMARY_VERTICALS),
  verticals: z.array(z.string().min(1).max(64)).min(1).max(12),
  agency: z.object({
    name: z.string().min(1).max(300),
    department: nullableString(200),
    city: nullableString(200),
    state: nullableString(2),
    country: z.string().min(2).max(80).default("US"),
  }),
  signal: z.object({
    type: z.enum(WATCH_SIGNAL_TYPES),
    category: z.string().min(1).max(120),
    strength: z.enum(WATCH_SIGNAL_STRENGTHS),
    buying_stage: z.enum(WATCH_SIGNAL_BUYING_STAGES),
    event_date: nullableString(32),
    title: z.string().min(1).max(500),
  }),
  opportunity: z.object({
    solicitation_number: nullableString(120),
    posted_date: nullableString(32),
    due_date: nullableString(64),
    status: nullableString(80),
    procurement_url: z.string().url().max(2000).nullable(),
  }),
  funding: z.object({
    estimated_contract_value: z.number().nullable(),
    project_budget: z.number().nullable(),
    grant_amount: z.number().nullable(),
    annual_support: z.number().nullable(),
    funding_source: nullableString(300),
  }),
  competitors: z.array(z.string().max(120)).max(20),
  technologies: z.array(z.string().max(120)).max(30),
  pain_points: z.array(z.string().max(500)).max(20),
  matched_capabilities: z.array(z.string().max(80)).max(20),
  facts: z.array(z.string().max(500)).max(20),
  inferences: z.array(z.string().max(500)).max(20),
  contacts: z
    .array(
      z.object({
        name: nullableString(200),
        title: nullableString(200),
        email: z.union([z.string().email().max(320), z.literal(""), z.null()]),
        phone: nullableString(40),
      }),
    )
    .max(20),
  qualification: z.object({
    fit: z.enum(["high", "medium", "low"]),
    strategy: z.enum(["direct", "partner", "monitor"]),
    reason: z.string().min(1).max(3000),
  }),
  next_action: z.string().min(1).max(3000),
  lifecycle: z.object({
    change_type: z.enum(WATCH_SIGNAL_LIFECYCLE_CHANGES),
    summary: z.string().min(1).max(3000),
  }),
  evidence: z.array(watchSignalEvidenceSchema).min(1).max(25),
});

export type WatchSignal = z.infer<typeof watchSignalSchema>;
export type WatchSignalEvidence = z.infer<typeof watchSignalEvidenceSchema>;

/** One signal per POST — arrays are rejected for the canonical /api/watch/ingest contract. */
export const watchSignalIngestBodySchema = watchSignalSchema;

export const watchIngestSuccessSchema = z.object({
  success: z.literal(true),
  action: z.enum(["created", "updated", "unchanged"]),
  signal_id: z.string(),
  external_key: z.string(),
  lifecycle_event_created: z.boolean(),
  possible_duplicate: z.boolean().optional(),
  possible_duplicate_of: z.string().optional(),
  priority_score: z.number().optional(),
  priority_label: z.enum(WATCH_SIGNAL_PRIORITY_LABELS).optional(),
});
export type WatchIngestSuccess = z.infer<typeof watchIngestSuccessSchema>;

export const watchSignalActionBodySchema = z
  .object({
    reason: z.string().max(2000).optional(),
    assigned_user: z.string().max(200).optional(),
    deal_name: z.string().max(300).optional(),
    notes: z.string().max(4000).optional(),
  })
  .optional()
  .default({});
