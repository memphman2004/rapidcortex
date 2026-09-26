/**
 * NexiQ sales automation — 3-touch sequences, content drafts, campaign jobs.
 * Stored on RAPID_IQ_PIPELINE_SIGNALS_TABLE (SEQ# / DRAFT# prefixes). Never auto-send cold outreach.
 */

import { z } from "zod";

export const RAPID_IQ_SALES_VERTICALS = [
  "PSAP",
  "CAMPUS",
  "VENUE",
  "HOSPITAL",
  "TRANSIT",
  "ALL",
] as const;
export type RapidIqSalesVertical = (typeof RAPID_IQ_SALES_VERTICALS)[number];

export const RAPID_IQ_SALES_SEQUENCE_STATUSES = [
  "draft",
  "approved",
  "active",
  "completed",
  "suppressed",
] as const;
export type RapidIqSalesSequenceStatus = (typeof RAPID_IQ_SALES_SEQUENCE_STATUSES)[number];

export const RAPID_IQ_SALES_STEP_STATUSES = [
  "pending",
  "scheduled",
  "sent",
  "opened",
  "clicked",
  "replied",
  "skipped",
] as const;
export type RapidIqSalesStepStatus = (typeof RAPID_IQ_SALES_STEP_STATUSES)[number];

export const RAPID_IQ_SALES_STEP_LABELS = ["initial", "followup_1", "followup_2"] as const;
export type RapidIqSalesStepLabel = (typeof RAPID_IQ_SALES_STEP_LABELS)[number];

export const RAPID_IQ_SALES_TRIGGER_TYPES = [
  "rfp_signal",
  "new_lead",
  "stage_advance",
  "campaign",
  "newsletter",
] as const;
export type RapidIqSalesTriggerType = (typeof RAPID_IQ_SALES_TRIGGER_TYPES)[number];

export const RAPID_IQ_SALES_CAMPAIGN_TYPES = [
  "budget_season",
  "conference_pre",
  "ng911_upgrade",
  "competitor_loss",
  "re_engagement",
] as const;
export type RapidIqSalesCampaignType = (typeof RAPID_IQ_SALES_CAMPAIGN_TYPES)[number];

export const RAPID_IQ_SALES_CONTENT_TYPES = [
  "newsletter",
  "campaign_email",
  "linkedin_post",
  "conference_pre",
  "re_engagement",
] as const;
export type RapidIqSalesContentType = (typeof RAPID_IQ_SALES_CONTENT_TYPES)[number];

export const RAPID_IQ_SALES_CONTENT_STATUSES = ["draft", "approved", "sent", "archived"] as const;
export type RapidIqSalesContentStatus = (typeof RAPID_IQ_SALES_CONTENT_STATUSES)[number];

export const RAPID_IQ_SALES_STEP_DELAYS: Record<RapidIqSalesStepLabel, number> = {
  initial: 0,
  followup_1: 5,
  followup_2: 12,
};

const VERTICAL_ALIASES: Record<string, RapidIqSalesVertical> = {
  psap: "PSAP",
  rc911: "PSAP",
  "911": "PSAP",
  core: "PSAP",
  campus: "CAMPUS",
  venue: "VENUE",
  hospital: "HOSPITAL",
  transit: "TRANSIT",
  airport: "TRANSIT",
  all: "ALL",
};

export function normalizeSalesAutomationVertical(raw: unknown): RapidIqSalesVertical {
  const key = String(raw ?? "")
    .trim()
    .toLowerCase()
    .replace(/_/g, "");
  return VERTICAL_ALIASES[key] ?? "PSAP";
}

export const rapidIqSalesOutreachEmailSchema = z.object({
  subject: z.string().min(1),
  bodyText: z.string().min(1),
  bodyHtml: z.string().optional(),
});
export type RapidIqSalesOutreachEmail = z.infer<typeof rapidIqSalesOutreachEmailSchema>;

export const rapidIqSalesOutreachStepSchema = z.object({
  stepId: z.string().min(1),
  stepNumber: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  label: z.enum(RAPID_IQ_SALES_STEP_LABELS),
  delayDays: z.number().int().min(0).max(90),
  scheduledAt: z.string().optional(),
  sentAt: z.string().optional(),
  openedAt: z.string().optional(),
  clickedAt: z.string().optional(),
  repliedAt: z.string().optional(),
  status: z.enum(RAPID_IQ_SALES_STEP_STATUSES),
  email: rapidIqSalesOutreachEmailSchema,
});
export type RapidIqSalesOutreachStep = z.infer<typeof rapidIqSalesOutreachStepSchema>;

export const rapidIqSalesSequenceSchema = z.object({
  sequenceId: z.string().min(1),
  triggerId: z.string().min(1),
  triggerType: z.enum(RAPID_IQ_SALES_TRIGGER_TYPES),
  vertical: z.enum(RAPID_IQ_SALES_VERTICALS),
  recipientEmail: z.string().min(1),
  recipientName: z.string().optional(),
  agencyName: z.string().min(1),
  status: z.enum(RAPID_IQ_SALES_SEQUENCE_STATUSES),
  autoApprove: z.boolean(),
  steps: z.array(rapidIqSalesOutreachStepSchema).min(1).max(3),
  createdAt: z.string(),
  updatedAt: z.string(),
  approvedAt: z.string().optional(),
  approvedBy: z.string().optional(),
  suppressedReason: z.string().optional(),
  attribution: z.object({
    signalId: z.string().optional(),
    leadId: z.string().optional(),
    rfpDeadline: z.string().optional(),
    estimatedValue: z.number().optional(),
    campaignType: z.enum(RAPID_IQ_SALES_CAMPAIGN_TYPES).optional(),
    conferenceName: z.string().optional(),
    campaignId: z.string().optional(),
    campaignName: z.string().optional(),
  }),
});
export type RapidIqSalesSequence = z.infer<typeof rapidIqSalesSequenceSchema>;

export const rapidIqSalesContentDraftSchema = z.object({
  draftId: z.string().min(1),
  contentType: z.enum(RAPID_IQ_SALES_CONTENT_TYPES),
  vertical: z.enum(RAPID_IQ_SALES_VERTICALS),
  weekOf: z.string().optional(),
  campaignType: z.string().optional(),
  subject: z.string().optional(),
  bodyText: z.string().min(1),
  linkedinText: z.string().optional(),
  status: z.enum(RAPID_IQ_SALES_CONTENT_STATUSES),
  createdAt: z.string(),
  updatedAt: z.string(),
  generatedBy: z.string(),
  tokenCount: z.number().optional(),
});
export type RapidIqSalesContentDraft = z.infer<typeof rapidIqSalesContentDraftSchema>;

export const rapidIqSalesMetricsSchema = z.object({
  sequencesThisWeek: z.number(),
  emailsSent: z.number(),
  openRate: z.number(),
  replyRate: z.number(),
  meetingsBooked: z.number(),
  rfpResponsesInProgress: z.number(),
  pendingApprovals: z.number(),
});
export type RapidIqSalesMetrics = z.infer<typeof rapidIqSalesMetricsSchema>;

export const rapidIqSalesCampaignCardSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  next: z.string(),
  status: z.enum(["scheduled", "active", "pending"]),
});
export type RapidIqSalesCampaignCard = z.infer<typeof rapidIqSalesCampaignCardSchema>;

export const createRapidIqSalesSequenceBodySchema = z.object({
  type: z.enum(["rfp_signal", "new_lead", "stage_advance", "campaign"]),
  agencyName: z.string().min(1).max(200),
  vertical: z.string().min(1).max(40),
  recipientEmail: z.string().email().optional(),
  recipientName: z.string().max(120).optional(),
  leadId: z.string().optional(),
  signalId: z.string().optional(),
  signalTitle: z.string().max(300).optional(),
  rfpDeadline: z.string().optional(),
  portalUrl: z.string().url().optional(),
  source: z.string().max(80).optional(),
  newStage: z.string().max(40).optional(),
  campaignType: z.enum(RAPID_IQ_SALES_CAMPAIGN_TYPES).optional(),
  campaignId: z.string().optional(),
  conferenceName: z.string().max(200).optional(),
  estimatedValue: z.number().optional(),
  sendAt: z.string().min(1).max(40).optional(),
});
export type CreateRapidIqSalesSequenceBody = z.infer<typeof createRapidIqSalesSequenceBodySchema>;

export const RAPID_IQ_SALES_SEQ_GSI2PK = "SEQ#ALL";
export const RAPID_IQ_SALES_DRAFT_GSI2PK = "DRAFT#ALL";
export const RAPID_IQ_SALES_BULK_MAX_RECIPIENTS = 500;

export const rapidIqSalesBulkRecipientSchema = z.object({
  email: z.string().email().max(200),
  agencyName: z.string().min(1).max(200),
  recipientName: z.string().max(120).optional(),
});
export type RapidIqSalesBulkRecipient = z.infer<typeof rapidIqSalesBulkRecipientSchema>;

export const createRapidIqSalesBulkCampaignBodySchema = z.object({
  vertical: z.string().min(1).max(40),
  campaignName: z.string().min(1).max(160).optional(),
  campaignType: z.enum(RAPID_IQ_SALES_CAMPAIGN_TYPES).optional(),
  recipients: z.array(rapidIqSalesBulkRecipientSchema).min(1).max(RAPID_IQ_SALES_BULK_MAX_RECIPIENTS),
  sendAt: z.string().min(1).max(40).optional(),
});
export type CreateRapidIqSalesBulkCampaignBody = z.infer<typeof createRapidIqSalesBulkCampaignBodySchema>;

export const approveRapidIqSalesBulkBodySchema = z.object({
  campaignId: z.string().min(1).max(120),
});
export type ApproveRapidIqSalesBulkBody = z.infer<typeof approveRapidIqSalesBulkBodySchema>;

export const rapidIqSalesBulkBatchSchema = z.object({
  campaignId: z.string(),
  campaignName: z.string(),
  vertical: z.enum(RAPID_IQ_SALES_VERTICALS),
  draftCount: z.number(),
  activeCount: z.number(),
  completedCount: z.number(),
  suppressedCount: z.number(),
  createdAt: z.string(),
});
export type RapidIqSalesBulkBatch = z.infer<typeof rapidIqSalesBulkBatchSchema>;

export const rapidIqSalesBulkResultSchema = z.object({
  campaignId: z.string(),
  campaignName: z.string(),
  created: z.number(),
  suppressed: z.number(),
  skipped: z.number(),
  duplicates: z.number(),
});
export type RapidIqSalesBulkResult = z.infer<typeof rapidIqSalesBulkResultSchema>;

export const rapidIqSalesBulkApproveResultSchema = z.object({
  campaignId: z.string(),
  approved: z.number(),
  suppressed: z.number(),
  failed: z.number(),
  sentNow: z.number(),
});
export type RapidIqSalesBulkApproveResult = z.infer<typeof rapidIqSalesBulkApproveResultSchema>;

/** Public Outlook mailbox status for RC Sales Automation campaign send. Never includes tokens. */
export const rapidIqOutlookStatusSchema = z.object({
  configured: z.boolean(),
  mock: z.boolean(),
  connected: z.boolean(),
  mailbox: z.string().optional(),
  expectedMailbox: z.string().optional(),
  connectedAt: z.string().optional(),
});
export type RapidIqOutlookStatus = z.infer<typeof rapidIqOutlookStatusSchema>;

export const rapidIqOutlookCallbackBodySchema = z.object({
  code: z.string().min(1).max(4096),
  state: z.string().min(1).max(1024),
});
export type RapidIqOutlookCallbackBody = z.infer<typeof rapidIqOutlookCallbackBodySchema>;

const salesEmailCopySchema = z.object({
  subject: z.string().min(1).max(300),
  bodyText: z.string().min(1).max(20_000),
});

export const updateRapidIqSalesSequenceStepSchema = z.object({
  stepNumber: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  email: salesEmailCopySchema.optional(),
  scheduledAt: z.string().max(40).optional(),
});

export const updateRapidIqSalesSequenceBodySchema = z
  .object({
    recipientEmail: z.string().email().max(200).optional(),
    recipientName: z.string().max(120).optional(),
    steps: z.array(updateRapidIqSalesSequenceStepSchema).min(1).max(3).optional(),
  })
  .refine((v) => Boolean(v.recipientEmail || v.recipientName !== undefined || (v.steps && v.steps.length > 0)), {
    message: "Provide recipient or at least one step email to update",
  });
export type UpdateRapidIqSalesSequenceBody = z.infer<typeof updateRapidIqSalesSequenceBodySchema>;

export const updateRapidIqSalesDraftBodySchema = z.object({
  subject: z.string().max(300).optional(),
  bodyText: z.string().min(1).max(20_000).optional(),
  linkedinText: z.string().max(8_000).optional(),
});
export type UpdateRapidIqSalesDraftBody = z.infer<typeof updateRapidIqSalesDraftBodySchema>;

export const updateRapidIqSalesBulkCopyBodySchema = z.object({
  campaignId: z.string().min(1).max(120),
  steps: z.array(updateRapidIqSalesSequenceStepSchema).min(1).max(3),
});
export type UpdateRapidIqSalesBulkCopyBody = z.infer<typeof updateRapidIqSalesBulkCopyBodySchema>;
