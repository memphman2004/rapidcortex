import { z } from "zod";

/** Sales enablement verticals (quotes, ROI, claims, RFP). */
export type RoiVertical = "rc911" | "campus" | "venue" | "hospital" | "transit";

export const RoiVerticalSchema = z.enum(["rc911", "campus", "venue", "hospital", "transit"]);

export interface RoiInputs {
  agencyName: string;
  vertical: RoiVertical;
  callVolume: number;
  seatCount: number;
  languageLineCostDollars: number;
  qaCostDollars: number;
  avgCallTimeSec: number;
  dispatcherHourlyRate: number;
}

export interface RoiSession {
  roiToken: string;
  inputs: RoiInputs;
  createdByEmail: string;
  createdAt: string;
  /** Unix epoch seconds — Dynamo TTL */
  ttl: number;
}

export type QuotePlan = "Essential" | "Professional" | "Command" | "Enterprise";

export interface QuoteAddOn {
  id: string;
  label: string;
  monthlyLow: number;
  monthlyHigh: number;
}

export interface QuoteConfig {
  agencyName: string;
  contactName: string;
  state: string;
  vertical: RoiVertical;
  seatCount: number;
  callVolume: number;
  plan: QuotePlan;
  selectedAddOns: string[];
  /** Feature / free-offering IDs from the sales feature catalog */
  selectedFeatureIds: string[];
  freeOfferings: string[];
  discountPercent: number;
  proposedBy: string;
  proposalDate: string;
  notes: string;
  leadId?: string;
}

export interface ActivityReport {
  contractorEmail: string;
  contractorName: string;
  /** ISO date of Monday that starts this week */
  weekOf: string;
  submittedAt: string;
  callsMade: number;
  emailsSent: number;
  meetingsBooked: number;
  demosDelivered: number;
  newLeadsAdded: number;
  stageAdvances: number;
  blockers: string;
  highlights: string;
}

export interface AccountClaim {
  agencySlug: string;
  agencyName: string;
  vertical: RoiVertical;
  state: string;
  claimedByEmail: string;
  claimedByName: string;
  claimedAt: string;
  notes: string;
}

export type RfpStage =
  | "IDENTIFIED"
  | "QUALIFYING"
  | "CAPTURE"
  | "NO_BID"
  | "PROPOSAL"
  | "SUBMITTED"
  | "AWARD"
  | "LOST";

export const RfpStageSchema = z.enum([
  "IDENTIFIED",
  "QUALIFYING",
  "CAPTURE",
  "NO_BID",
  "PROPOSAL",
  "SUBMITTED",
  "AWARD",
  "LOST",
]);

export interface RfpRecord {
  rfpId: string;
  rfpNumber: string;
  title: string;
  agencyName: string;
  vertical: RoiVertical;
  state: string;
  stage: RfpStage;
  deadlineDate: string;
  estimatedValueDollars: number;
  assignedTo: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export type FreeTierOfferId =
  | "community_tip_line"
  | "agency_intelligence_scan"
  | "dispatcher_wellness";

export interface FreeTierRegistration {
  registrationId: string;
  offerId: FreeTierOfferId;
  agencyName: string;
  contactName: string;
  contactEmail: string;
  vertical: RoiVertical;
  state: string;
  tipForwardEmail?: string;
  notes?: string;
  createdAt: string;
  source: "self_register" | "sales_order";
}

export const createRoiSessionBodySchema = z
  .object({
    inputs: z.object({
      agencyName: z.string().trim().min(1).max(300),
      vertical: RoiVerticalSchema,
      callVolume: z.number().min(0).max(10_000_000),
      seatCount: z.number().min(1).max(10_000),
      languageLineCostDollars: z.number().min(0).max(10_000_000),
      qaCostDollars: z.number().min(0).max(10_000_000),
      avgCallTimeSec: z.number().min(0).max(86_400),
      dispatcherHourlyRate: z.number().min(0).max(1000),
    }),
  })
  .strict();

export const createActivityReportBodySchema = z
  .object({
    weekOf: z.string().min(8).max(32),
    contractorName: z.string().trim().min(1).max(200),
    callsMade: z.number().int().min(0).max(100_000),
    emailsSent: z.number().int().min(0).max(100_000),
    meetingsBooked: z.number().int().min(0).max(100_000),
    demosDelivered: z.number().int().min(0).max(100_000),
    newLeadsAdded: z.number().int().min(0).max(100_000),
    stageAdvances: z.number().int().min(0).max(100_000),
    blockers: z.string().max(4000).optional().default(""),
    highlights: z.string().max(4000).optional().default(""),
  })
  .strict();

export const createAccountClaimBodySchema = z
  .object({
    agencySlug: z.string().trim().min(1).max(120),
    agencyName: z.string().trim().min(1).max(300),
    vertical: RoiVerticalSchema,
    state: z.string().trim().min(2).max(2),
    notes: z.string().max(2000).optional().default(""),
  })
  .strict();

export const createRfpBodySchema = z
  .object({
    rfpNumber: z.string().max(80).optional().default(""),
    title: z.string().trim().min(1).max(400),
    agencyName: z.string().trim().min(1).max(300),
    vertical: RoiVerticalSchema,
    state: z.string().trim().min(0).max(2).optional().default(""),
    deadlineDate: z.string().max(64).optional().default(""),
    estimatedValueDollars: z.number().min(0).max(100_000_000).optional().default(0),
    assignedTo: z.string().max(320).optional().default(""),
    notes: z.string().max(4000).optional().default(""),
  })
  .strict();

export const patchRfpBodySchema = z
  .object({
    stage: RfpStageSchema.optional(),
    title: z.string().trim().min(1).max(400).optional(),
    agencyName: z.string().trim().min(1).max(300).optional(),
    vertical: RoiVerticalSchema.optional(),
    state: z.string().trim().min(0).max(2).optional(),
    deadlineDate: z.string().max(64).optional(),
    estimatedValueDollars: z.number().min(0).max(100_000_000).optional(),
    assignedTo: z.string().max(320).optional(),
    notes: z.string().max(4000).optional(),
    rfpNumber: z.string().max(80).optional(),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, { message: "At least one field is required" });

export const freeTierRegisterBodySchema = z
  .object({
    offerId: z.enum(["community_tip_line", "agency_intelligence_scan", "dispatcher_wellness"]),
    agencyName: z.string().trim().min(1).max(300),
    contactName: z.string().trim().min(1).max(200),
    contactEmail: z.string().email().max(320),
    vertical: RoiVerticalSchema,
    state: z.string().trim().min(2).max(2),
    tipForwardEmail: z.string().email().max(320).optional(),
    notes: z.string().max(2000).optional(),
  })
  .strict();
