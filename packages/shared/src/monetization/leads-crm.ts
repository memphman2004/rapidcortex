import { z } from "zod";

/** 9-stage CRM pipeline [CR-3]. */
export const PIPELINE_STAGES = [
  "NEW",
  "CONTACTED",
  "QUALIFIED",
  "DISCOVERY",
  "PROPOSAL",
  "NEGOTIATION",
  "PILOT",
  "WON",
  "LOST",
] as const;

export type PipelineStage = (typeof PIPELINE_STAGES)[number];

export const PipelineStageSchema = z.enum(PIPELINE_STAGES);

/** Board columns — outcomes stay as counters [CR]. */
export const ACTIVE_PIPELINE_STAGES: PipelineStage[] = [
  "NEW",
  "CONTACTED",
  "QUALIFIED",
  "DISCOVERY",
  "PROPOSAL",
  "NEGOTIATION",
  "PILOT",
];

export const OUTCOME_PIPELINE_STAGES: PipelineStage[] = ["WON", "LOST"];

/** Maps legacy lowercase `status` → PipelineStage [CR-2]. */
export const LEGACY_STATUS_TO_STAGE: Record<string, PipelineStage> = {
  new: "NEW",
  contacted: "CONTACTED",
  qualified: "QUALIFIED",
  discovery: "DISCOVERY",
  proposal: "PROPOSAL",
  negotiation: "NEGOTIATION",
  pilot: "PILOT",
  won: "WON",
  lost: "LOST",
};

/** Maps PipelineStage → legacy lowercase `status` [CR-2]. */
export const STAGE_TO_LEGACY_STATUS: Record<PipelineStage, string> = {
  NEW: "new",
  CONTACTED: "contacted",
  QUALIFIED: "qualified",
  DISCOVERY: "discovery",
  PROPOSAL: "proposal",
  NEGOTIATION: "negotiation",
  PILOT: "pilot",
  WON: "won",
  LOST: "lost",
};

export function stageToPipelineStageAndStatus(stage: PipelineStage): {
  pipelineStage: PipelineStage;
  status: string;
} {
  return { pipelineStage: stage, status: STAGE_TO_LEGACY_STATUS[stage] };
}

export function legacyStatusToStage(status: string | undefined | null): PipelineStage {
  const key = String(status ?? "new").toLowerCase();
  return LEGACY_STATUS_TO_STAGE[key] ?? "NEW";
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
  contact_sales: {
    icon: "💼",
    label: "Contact Sales",
    color: "#3b82f6",
    description: "Marketing site contact form",
  },
  inside_the_cortex: {
    icon: "🧠",
    label: "Inside the Cortex",
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
    label: "New",
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
  PROPOSAL: {
    label: "Proposal",
    bgClass: "bg-purple-950",
    textClass: "text-purple-300",
    borderClass: "border-l-purple-400",
  },
  NEGOTIATION: {
    label: "Negotiating",
    bgClass: "bg-pink-950",
    textClass: "text-pink-300",
    borderClass: "border-l-pink-400",
  },
  PILOT: {
    label: "Pilot",
    bgClass: "bg-green-950",
    textClass: "text-green-300",
    borderClass: "border-l-green-400",
  },
  WON: {
    label: "Won",
    bgClass: "bg-green-950",
    textClass: "text-green-400",
    borderClass: "border-l-green-500",
  },
  LOST: {
    label: "Lost",
    bgClass: "bg-red-950",
    textClass: "text-red-400",
    borderClass: "border-l-red-500",
  },
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
    /** Legacy assignee alias — maps to assignedTo on write. */
    assignee: z.string().max(320).optional(),
    /** Legacy status write still accepted; also sets pipelineStage [CR-2]. */
    status: z.string().max(40).optional(),
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
};
