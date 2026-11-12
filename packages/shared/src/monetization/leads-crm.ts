import { z } from "zod";

/**
 * Sales CRM pipeline stages — aligned to the sales playbook entry-criteria table.
 * Stored as uppercase tokens on SalesLead.pipelineStage.
 */
export const PIPELINE_STAGES = [
  "NEW",
  "CONTACTED",
  "ENGAGED",
  "QUALIFIED",
  "DISCOVERY",
  "DEMO_SCHEDULED",
  "DEMO_COMPLETED",
  "PROPOSAL",
  "PROCUREMENT",
  "CONTRACTING",
  "WON",
  "LOST",
] as const;

export type PipelineStage = (typeof PIPELINE_STAGES)[number];

export const PipelineStageSchema = z.enum(PIPELINE_STAGES);

const PIPELINE_STAGE_SET = new Set<string>(PIPELINE_STAGES);

/** Board columns — outcomes stay as counters. */
export const ACTIVE_PIPELINE_STAGES: PipelineStage[] = [
  "NEW",
  "CONTACTED",
  "ENGAGED",
  "QUALIFIED",
  "DISCOVERY",
  "DEMO_SCHEDULED",
  "DEMO_COMPLETED",
  "PROPOSAL",
  "PROCUREMENT",
  "CONTRACTING",
];

export const OUTCOME_PIPELINE_STAGES: PipelineStage[] = ["WON", "LOST"];

/**
 * Retired stage tokens → current stage (read-path + durable migrate).
 * NEGOTIATION / PILOT were the prior 9-stage board columns.
 */
export const LEGACY_PIPELINE_STAGE_ALIASES: Record<string, PipelineStage> = {
  NEGOTIATION: "CONTRACTING",
  NEGOTIATING: "CONTRACTING",
  PILOT: "DEMO_COMPLETED",
};

/** Maps legacy lowercase `status` → PipelineStage [CR-2]. */
export const LEGACY_STATUS_TO_STAGE: Record<string, PipelineStage> = {
  new: "NEW",
  new_lead: "NEW",
  contacted: "CONTACTED",
  engaged: "ENGAGED",
  qualified: "QUALIFIED",
  discovery: "DISCOVERY",
  demo_scheduled: "DEMO_SCHEDULED",
  demo_completed: "DEMO_COMPLETED",
  proposal: "PROPOSAL",
  proposal_quote: "PROPOSAL",
  procurement: "PROCUREMENT",
  funding: "PROCUREMENT",
  contracting: "CONTRACTING",
  negotiation: "CONTRACTING",
  negotiating: "CONTRACTING",
  pilot: "DEMO_COMPLETED",
  won: "WON",
  closed_won: "WON",
  lost: "LOST",
  closed_lost: "LOST",
};

/** Maps PipelineStage → legacy lowercase `status` [CR-2]. */
export const STAGE_TO_LEGACY_STATUS: Record<PipelineStage, string> = {
  NEW: "new",
  CONTACTED: "contacted",
  ENGAGED: "engaged",
  QUALIFIED: "qualified",
  DISCOVERY: "discovery",
  DEMO_SCHEDULED: "demo_scheduled",
  DEMO_COMPLETED: "demo_completed",
  PROPOSAL: "proposal",
  PROCUREMENT: "procurement",
  CONTRACTING: "contracting",
  WON: "won",
  LOST: "lost",
};

/** Normalize any stored/raw stage token onto the current pipeline. */
export function normalizePipelineStage(raw: unknown): PipelineStage {
  const token = String(raw ?? "").trim();
  if (!token) return "NEW";
  const upper = token.toUpperCase().replace(/[\s/-]+/g, "_");
  if (PIPELINE_STAGE_SET.has(upper)) return upper as PipelineStage;
  if (LEGACY_PIPELINE_STAGE_ALIASES[upper]) return LEGACY_PIPELINE_STAGE_ALIASES[upper]!;
  const lower = token.toLowerCase().replace(/[\s/-]+/g, "_");
  return LEGACY_STATUS_TO_STAGE[lower] ?? "NEW";
}

export function stageToPipelineStageAndStatus(stage: PipelineStage): {
  pipelineStage: PipelineStage;
  status: string;
} {
  return { pipelineStage: stage, status: STAGE_TO_LEGACY_STATUS[stage] };
}

export function legacyStatusToStage(status: string | undefined | null): PipelineStage {
  return normalizePipelineStage(status ?? "new");
}

export const LeadNoteSchema = z.object({
  noteId: z.string().min(1),
  text: z.string().min(1).max(2000),
  authorId: z.string(),
  authorName: z.string(),
  createdAt: z.string(),
  pinned: z.boolean().optional(),
});
export type LeadNote = z.infer<typeof LeadNoteSchema>;

export const LeadActivityTypeSchema = z.enum([
  "created",
  "stage_change",
  "note_added",
  "call_logged",
  "email_logged",
  "task_added",
  "field_updated",
]);
export type LeadActivityType = z.infer<typeof LeadActivityTypeSchema>;

export const LeadActivitySchema = z.object({
  activityId: z.string().min(1),
  type: LeadActivityTypeSchema,
  description: z.string(),
  authorId: z.string().optional(),
  authorName: z.string().optional(),
  createdAt: z.string(),
  metadata: z.record(z.string()).optional(),
});
export type LeadActivity = z.infer<typeof LeadActivitySchema>;

export const StageEventSchema = z.object({
  from: PipelineStageSchema,
  to: PipelineStageSchema,
  changedAt: z.string(),
  changedBy: z.string(),
  changedByName: z.string(),
  note: z.string().optional(),
});
export type StageEvent = z.infer<typeof StageEventSchema>;

export const LeadChannelSchema = z.enum([
  "ring_waitlist",
  "email_campaign",
  "contact_sales",
  "inside_the_cortex",
  "organic_search",
  "linkedin",
  "referral",
  "direct",
  "other",
]);
export type LeadChannel = z.infer<typeof LeadChannelSchema>;

export const LeadAttributionSchema = z.object({
  channel: LeadChannelSchema,
  channelLabel: z.string(),
  landingPage: z.string().nullish(),
  referrerUrl: z.string().nullish(),
  referrerDomain: z.string().nullish(),
  utmSource: z.string().nullish(),
  utmMedium: z.string().nullish(),
  utmCampaign: z.string().nullish(),
  utmContent: z.string().nullish(),
  deviceType: z.enum(["mobile", "tablet", "desktop"]).nullish(),
  ipRegion: z.string().nullish(),
  ipCity: z.string().nullish(),
  ipCountry: z.string().nullish(),
  firstTouchAt: z.string(),
});
export type LeadAttribution = z.infer<typeof LeadAttributionSchema>;

export const LeadVerticalSchema = z.enum([
  "rc911",
  "law_enforcement",
  "fire_ems",
  "campus",
  "venue",
  "hospital",
  "transit",
  "unknown",
]);
export type LeadVertical = z.infer<typeof LeadVerticalSchema>;

export const LOST_REASONS = [
  "Budget",
  "No authority",
  "Competitor",
  "Timing",
  "Not a fit",
  "No response",
  "Other",
] as const;

export const CHANNEL_CONFIG: Record<
  LeadChannel,
  { icon: string; label: string; color: string; description: string }
> = {
  ring_waitlist: {
    icon: "🔔",
    label: "Ring Waitlist",
    color: "#22c55e",
    description: "Homeowner enrolled their Ring device",
  },
  email_campaign: {
    icon: "✉️",
    label: "Email campaign",
    color: "#38bdf8",
    description: "Contact added from an Apollo email campaign",
  },
  contact_sales: {
    icon: "💼",
    label: "Contact Sales",
    color: "#3b82f6",
    description: "Marketing site contact form",
  },
  inside_the_cortex: {
    icon: "🧠",
    label: "Inside iQ",
    color: "#a78bfa",
    description: "Newsletter signup popup",
  },
  organic_search: {
    icon: "🔍",
    label: "Organic Search",
    color: "#22d3ee",
    description: "Google / Bing organic result",
  },
  linkedin: {
    icon: "💼",
    label: "LinkedIn",
    color: "#0077b5",
    description: "LinkedIn ad or organic post",
  },
  referral: {
    icon: "🤝",
    label: "Referral",
    color: "#f97316",
    description: "Referred by another agency or contact",
  },
  direct: {
    icon: "⚡",
    label: "Direct",
    color: "#eab308",
    description: "Direct URL visit, no referrer",
  },
  other: {
    icon: "❓",
    label: "Other",
    color: "#6b83a8",
    description: "Unknown or unlabeled source",
  },
};

export const STAGE_CONFIG: Record<
  PipelineStage,
  { label: string; bgClass: string; textClass: string; borderClass: string }
> = {
  NEW: {
    label: "New Lead",
    bgClass: "bg-blue-950",
    textClass: "text-blue-300",
    borderClass: "border-l-blue-400",
  },
  CONTACTED: {
    label: "Contacted",
    bgClass: "bg-cyan-950",
    textClass: "text-cyan-300",
    borderClass: "border-l-cyan-400",
  },
  ENGAGED: {
    label: "Engaged",
    bgClass: "bg-sky-950",
    textClass: "text-sky-300",
    borderClass: "border-l-sky-400",
  },
  QUALIFIED: {
    label: "Qualified",
    bgClass: "bg-emerald-950",
    textClass: "text-emerald-300",
    borderClass: "border-l-emerald-400",
  },
  DISCOVERY: {
    label: "Discovery",
    bgClass: "bg-yellow-950",
    textClass: "text-yellow-300",
    borderClass: "border-l-yellow-400",
  },
  DEMO_SCHEDULED: {
    label: "Demo Scheduled",
    bgClass: "bg-amber-950",
    textClass: "text-amber-300",
    borderClass: "border-l-amber-400",
  },
  DEMO_COMPLETED: {
    label: "Demo Completed",
    bgClass: "bg-orange-950",
    textClass: "text-orange-300",
    borderClass: "border-l-orange-400",
  },
  PROPOSAL: {
    label: "Proposal / Quote",
    bgClass: "bg-purple-950",
    textClass: "text-purple-300",
    borderClass: "border-l-purple-400",
  },
  PROCUREMENT: {
    label: "Procurement / Funding",
    bgClass: "bg-fuchsia-950",
    textClass: "text-fuchsia-300",
    borderClass: "border-l-fuchsia-400",
  },
  CONTRACTING: {
    label: "Contracting",
    bgClass: "bg-pink-950",
    textClass: "text-pink-300",
    borderClass: "border-l-pink-400",
  },
  WON: {
    label: "Closed Won",
    bgClass: "bg-green-950",
    textClass: "text-green-400",
    borderClass: "border-l-green-500",
  },
  LOST: {
    label: "Closed Lost",
    bgClass: "bg-red-950",
    textClass: "text-red-400",
    borderClass: "border-l-red-500",
  },
};

/** Playbook entry criteria shown in stage tooltips / docs. */
export const STAGE_ENTRY_CRITERIA: Record<PipelineStage, string> = {
  NEW: "Agency identified, no outreach initiated.",
  CONTACTED: "First email, phone call, or LinkedIn message sent.",
  ENGAGED: "Someone responds or requests information.",
  QUALIFIED: "Confirmed relevant need, appropriate contact, and potential opportunity.",
  DISCOVERY: "Meeting to understand CAD, call volumes, challenges, funding, and buying process.",
  DEMO_SCHEDULED: "Agency accepts a product demonstration and date is confirmed.",
  DEMO_COMPLETED: "Demonstration delivered; next steps or objections documented.",
  PROPOSAL: "Agency receives formal pricing, scope, and timeline.",
  PROCUREMENT: "Agency is pursuing budget approval, grant reimbursement, RFP, or purchase authorization.",
  CONTRACTING: "Legal, security, purchasing, or contract negotiations are underway.",
  WON: "Signed agreement or binding purchase order obtained.",
  LOST: "Opportunity definitively declined, awarded elsewhere, or canceled.",
};

/** CRM field patch body (does not move pipeline stage). */
export const patchSalesLeadCrmBodySchema = z
  .object({
    firstName: z.string().max(100).optional(),
    lastName: z.string().max(100).optional(),
    phone: z.string().max(40).optional(),
    title: z.string().max(200).optional(),
    agencyName: z.string().max(300).optional(),
    agencyType: z.string().max(100).optional(),
    vertical: LeadVerticalSchema.optional(),
    estimatedValue: z.number().min(0).max(100_000_000).optional(),
    probability: z.number().min(0).max(100).optional(),
    assignedTo: z.string().max(320).optional(),
    assignedToName: z.string().max(200).optional(),
    nextAction: z.string().max(500).optional(),
    nextActionDate: z.string().max(64).optional(),
    packageSold: z.enum(["rc_core", "rc_campus", "rc_venue", "rc_lite", "none"]).optional(),
    lostReason: z.string().max(200).optional(),
    /** Sales order feature IDs from sales feature catalog (no prices). */
    selectedFeatureIds: z.array(z.string().min(1).max(80)).max(100).optional(),
    /** Free offering IDs included on the order. */
    freeOfferings: z.array(z.string().min(1).max(80)).max(50).optional(),
    /** Legacy assignee alias — maps to assignedTo on write. */
    assignee: z.string().max(320).optional(),
    /** Legacy status write still accepted; also sets pipelineStage [CR-2]. */
    status: z.string().max(40).optional(),
    /**
     * Business Communications SMS authorization for sales advisors.
     * pending = share opt-in link; opted_in = may text; opted_out = do not text.
     */
    smsConsentStatus: z.enum(["pending", "opted_in", "opted_out"]).optional(),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, { message: "At least one field is required" });

export type PatchSalesLeadCrmBody = z.infer<typeof patchSalesLeadCrmBodySchema>;

export const patchSalesLeadStageBodySchema = z
  .object({
    stage: PipelineStageSchema,
    note: z.string().max(2000).optional(),
    lostReason: z.string().max(200).optional(),
    pilotStartDate: z.string().max(64).optional(),
  })
  .strict()
  .superRefine((v, ctx) => {
    if (v.stage === "LOST" && !v.lostReason?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "lostReason is required when moving to LOST",
        path: ["lostReason"],
      });
    }
  });

export type PatchSalesLeadStageBody = z.infer<typeof patchSalesLeadStageBodySchema>;

export const addSalesLeadNoteBodySchema = z
  .object({
    text: z.string().trim().min(1).max(2000),
    pinned: z.boolean().optional(),
  })
  .strict();

export type AddSalesLeadNoteBody = z.infer<typeof addSalesLeadNoteBodySchema>;

export const addSalesLeadActivityBodySchema = z
  .object({
    type: z.enum(["call_logged", "email_logged", "task_added", "note_added"]),
    description: z.string().trim().min(1).max(2000),
    metadata: z.record(z.string()).optional(),
  })
  .strict();

export type AddSalesLeadActivityBody = z.infer<typeof addSalesLeadActivityBodySchema>;

/** Manual handoff from Prospects into Leads CRM. Does not remove the prospect. */
export const sendProspectToLeadBodySchema = z
  .object({
    prospectId: z.string().trim().min(1).max(128),
    existingLeadId: z.string().trim().min(1).max(128).optional(),
    agencyName: z.string().trim().min(1).max(300),
    contactName: z.string().trim().max(200).optional(),
    contactTitle: z.string().trim().max(200).optional(),
    contactEmail: z.string().trim().max(320).optional(),
    contactPhone: z.string().trim().max(40).optional(),
    city: z.string().trim().max(100).optional(),
    state: z.string().trim().max(8).optional(),
    vertical: z.enum(["psap", "campus", "venue", "hospital", "transit"]).optional(),
    outreachStatus: z.enum([
      "UNCONTACTED",
      "MAILED",
      "CALLED",
      "EMAILED",
      "ENGAGED",
      "DEMO_SCHEDULED",
      "PILOT",
      "CUSTOMER",
      "NOT_INTERESTED",
      "DO_NOT_CONTACT",
    ]),
    estimatedValue: z.number().optional(),
    notes: z.string().trim().max(2000).optional(),
  })
  .strict();

export type SendProspectToLeadBody = z.infer<typeof sendProspectToLeadBodySchema>;

/** Map prospect outreach status onto the current CRM pipeline stage. */
export function leadStageForProspectOutreach(
  status: SendProspectToLeadBody["outreachStatus"],
): PipelineStage {
  if (status === "CUSTOMER") return "WON";
  if (status === "PILOT") return "DEMO_COMPLETED";
  if (status === "DEMO_SCHEDULED") return "DEMO_SCHEDULED";
  if (status === "ENGAGED") return "ENGAGED";
  if (status === "NOT_INTERESTED" || status === "DO_NOT_CONTACT") return "LOST";
  if (status === "MAILED" || status === "CALLED" || status === "EMAILED") return "CONTACTED";
  return "NEW";
}

/** Full CRM lead shape returned to the UI (existing fields + extensions). */
export type SalesLeadCrmRecord = {
  leadId: string;
  email: string;
  createdAt: string;
  source?: string;
  status?: string;
  packageSold?: string;
  assignee?: string;
  updatedAt?: string;
  updatedBy?: string;
  name?: string;
  phone?: string;
  agencyCompany?: string;
  role?: string;
  customerType?: string;
  interestedIn?: string[];
  estimatedAgencySize?: string;
  message?: string;
  requestedState?: string | null;
  requestedCity?: string | null;
  state?: string | null;
  pipelineStage: PipelineStage;
  stageUpdatedAt?: string;
  stageHistory?: StageEvent[];
  firstName?: string;
  lastName?: string;
  title?: string;
  agencyName?: string;
  agencyType?: string;
  vertical?: LeadVertical;
  estimatedValue?: number;
  probability?: number;
  assignedTo?: string;
  assignedToName?: string;
  nextAction?: string;
  nextActionDate?: string;
  lastContactedAt?: string;
  lostReason?: string;
  wonDate?: string;
  pilotStartDate?: string;
  notes?: LeadNote[];
  activities?: LeadActivity[];
  attribution?: LeadAttribution;
  /** Sales order selections from the sales feature catalog. */
  selectedFeatureIds?: string[];
  freeOfferings?: string[];
  /** Outbound / grant intelligence signals (vertical-scoped via LeadSignal.vertical). */
  signals?: import("../sales/grant-signal-types.js").LeadSignal[];
  signalCount?: number;
  lastSignalAt?: string;
  /** 0–100 rolling score from recent signals. */
  hotScore?: number;
  /** Business Communications SMS — from public opt-in forms. */
  smsConsentOptedIn?: boolean;
  smsConsentAt?: string | null;
  smsConsentDisclosureVersion?: string;
  formSource?: string;
  /** PSAP / outreach prospect this lead was created from. Prospect record is kept. */
  prospectId?: string;
  /**
   * Advisor-facing authorization status. Prefer {@link resolveLeadSmsConsentStatus}.
   * opted_out can be set manually when a prospect revokes consent (e.g. STOP).
   */
  smsConsentStatus?: "pending" | "opted_in" | "opted_out";
  /** Set after a reply is copied to HubSpot. */
  hubspotContactId?: string;
  hubspotDealId?: string;
  crmSyncedAt?: string;
};
