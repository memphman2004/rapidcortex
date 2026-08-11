import { z } from "zod";

export const rapidIqVerticalSchema = z.enum(["911", "campus", "venue"]);
export type RapidIqVertical = z.infer<typeof rapidIqVerticalSchema>;

export const rcProductSchema = z.enum(["core", "campus", "venue", "connect"]);
export type RcProduct = z.infer<typeof rcProductSchema>;

export const intentStageSchema = z.enum([
  "awareness",
  "evaluation",
  "active_rfp",
  "award_imminent",
]);
export type IntentStage = z.infer<typeof intentStageSchema>;

export const signalTypeSchema = z.enum([
  "rfp",
  "rfi",
  "budget",
  "meeting_minutes",
  "news",
  "grant",
  "leadership_change",
  "competitor",
]);
export type SignalType = z.infer<typeof signalTypeSchema>;

export const contactRoleTierSchema = z.enum([
  "primary",
  "secondary",
  "procurement",
  "executive",
]);
export type ContactRoleTier = z.infer<typeof contactRoleTierSchema>;

export const contactMatchTypeSchema = z.enum(["exact", "related", "mentioned", "none"]);
export type ContactMatchType = z.infer<typeof contactMatchTypeSchema>;

export const verificationStatusSchema = z.enum(["verified", "predicted", "unverified"]);
export type VerificationStatus = z.infer<typeof verificationStatusSchema>;

export const opportunityStatusSchema = z.enum([
  "new",
  "reviewed",
  "converted",
  "dismissed",
  "watching",
]);
export type OpportunityStatus = z.infer<typeof opportunityStatusSchema>;

export const rapidIqOpportunitySchema = z.object({
  opportunityId: z.string().min(1),
  vertical: rapidIqVerticalSchema,
  rcProduct: rcProductSchema,
  agencyName: z.string().min(1),
  agencyType: z.string().min(1),
  city: z.string(),
  state: z.string().min(2).max(2),
  county: z.string(),
  population: z.number().nullable(),
  opportunityScore: z.number().min(0).max(100),
  fitScore: z.number().min(0).max(100),
  intentStage: intentStageSchema,
  estimatedDecisionDays: z.number().nullable(),
  incumbentVendor: z.string().nullable(),
  contractExpirySignal: z.boolean(),
  estimatedDollarValue: z.number().nullable(),
  dollarValueSource: z.string().nullable(),
  aiHeadline: z.string(),
  aiSummary: z.string(),
  talkingPoints: z.array(z.string()).nullable(),
  signalCount: z.number().int().nonnegative(),
  lastSignalAt: z.string(),
  detectedAt: z.string(),
  lastRefreshedAt: z.string(),
  status: opportunityStatusSchema,
  convertedLeadId: z.string().nullable(),
  assignedTo: z.string().nullable(),
  notes: z.string().nullable(),
  tags: z.array(z.string()),
  isActNow: z.boolean(),
});
export type RapidIqOpportunity = z.infer<typeof rapidIqOpportunitySchema>;

export const rapidIqSignalSchema = z.object({
  signalId: z.string().min(1),
  opportunityId: z.string().min(1),
  signalType: signalTypeSchema,
  title: z.string(),
  summary: z.string(),
  excerpt: z.string(),
  sourceName: z.string(),
  sourceType: z.string(),
  sourceUrl: z.string(),
  sourceDocUrl: z.string().nullable(),
  pageReference: z.string().nullable(),
  publishedAt: z.string(),
  detectedAt: z.string(),
  scoreContrib: z.number(),
});
export type RapidIqSignal = z.infer<typeof rapidIqSignalSchema>;

export const rapidIqContactSchema = z.object({
  contactId: z.string().min(1),
  opportunityId: z.string().min(1),
  name: z.string().nullable(),
  title: z.string(),
  roleTier: contactRoleTierSchema,
  matchType: contactMatchTypeSchema,
  matchedOn: z.string().nullable(),
  verificationStatus: verificationStatusSchema,
  verificationSource: z.string().nullable(),
  sourceCount: z.number().int().nonnegative(),
  verifiedAt: z.string().nullable(),
  sourceUrl: z.string().nullable(),
  email: z.string().nullable(),
  emailVerified: z.boolean(),
  phone: z.string().nullable(),
  linkedInUrl: z.string().nullable(),
});
export type RapidIqContact = z.infer<typeof rapidIqContactSchema>;

export const rapidIqSourceSchema = z.object({
  sourceId: z.string().min(1),
  opportunityId: z.string().min(1),
  sourceRole: z.enum(["primary", "supporting", "procurement", "budget", "contact"]),
  title: z.string(),
  url: z.string(),
  docUrl: z.string().nullable(),
  documentType: z.string(),
  excerpt: z.string().nullable(),
  pageReference: z.string().nullable(),
  publishedAt: z.string().nullable(),
  retrievedAt: z.string(),
});
export type RapidIqSource = z.infer<typeof rapidIqSourceSchema>;

export const mentionedEntitySchema = z.object({
  name: z.string(),
  role: z.string(),
  status: z.enum(["found", "searching", "not_found"]),
  linkedContactId: z.string().nullable(),
});
export type MentionedEntity = z.infer<typeof mentionedEntitySchema>;

export const refreshStatusSchema = z.object({
  status: z.enum(["idle", "running", "complete", "error"]),
  startedAt: z.string().nullable(),
  completedAt: z.string().nullable(),
  signalsFound: z.number().int().nonnegative(),
  error: z.string().nullable(),
});
export type RefreshStatus = z.infer<typeof refreshStatusSchema>;

export const signalChatMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string(),
});
export type SignalChatMessage = z.infer<typeof signalChatMessageSchema>;

export const updateOpportunityBodySchema = z.object({
  status: opportunityStatusSchema.optional(),
  notes: z.string().nullable().optional(),
  assignedTo: z.string().nullable().optional(),
  tags: z.array(z.string()).optional(),
});
export type UpdateOpportunityBody = z.infer<typeof updateOpportunityBodySchema>;

export const convertToLeadBodySchema = z.object({
  opportunityId: z.string().min(1),
  assignee: z.string().optional(),
  notes: z.string().optional(),
});
export type ConvertToLeadBody = z.infer<typeof convertToLeadBodySchema>;

export const signalChatBodySchema = z.object({
  opportunityId: z.string().min(1),
  message: z.string().min(1).max(4000),
  history: z.array(signalChatMessageSchema).max(20).optional(),
});
export type SignalChatBody = z.infer<typeof signalChatBodySchema>;

export const talkingPointsBodySchema = z.object({
  opportunityId: z.string().min(1),
});
export type TalkingPointsBody = z.infer<typeof talkingPointsBodySchema>;

export const outreachBodySchema = z.object({
  opportunityId: z.string().min(1),
  contactId: z.string().min(1).optional(),
});
export type OutreachBody = z.infer<typeof outreachBodySchema>;

export const rfpOutlineBodySchema = z.object({
  opportunityId: z.string().min(1),
});
export type RfpOutlineBody = z.infer<typeof rfpOutlineBodySchema>;

export const agencyProfileBodySchema = z.object({
  opportunityId: z.string().min(1),
});
export type AgencyProfileBody = z.infer<typeof agencyProfileBodySchema>;

export const researchAgencyBodySchema = z.object({
  opportunityId: z.string().min(1),
});
export type ResearchAgencyBody = z.infer<typeof researchAgencyBodySchema>;

export const competitorIntelBodySchema = z.object({
  opportunityId: z.string().min(1),
});
export type CompetitorIntelBody = z.infer<typeof competitorIntelBodySchema>;

export const searchContactsBodySchema = z.object({
  opportunityId: z.string().min(1),
  query: z.string().max(200).optional(),
});
export type SearchContactsBody = z.infer<typeof searchContactsBodySchema>;

/** RC Admin Rapid IQ — rcsuperadmin and rcadmin only (not rcitadmin). */
export function canAccessRapidIq(role: string | undefined | null): boolean {
  const r = String(role ?? "").trim().toLowerCase();
  return r === "rcsuperadmin" || r === "rcadmin";
}
