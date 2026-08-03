import { z } from "zod";

/** ATS pipeline statuses for job applications. */
export const APPLICATION_STATUSES = [
  "NEW",
  "REVIEWING",
  "PHONE_SCREEN",
  "INTERVIEW",
  "OFFER",
  "HIRED",
  "REJECTED",
  "WITHDRAWN",
] as const;

export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

export const ApplicationStatusSchema = z.enum(APPLICATION_STATUSES);

/** Board columns — terminal states stay as filters/outcomes. */
export const ATS_STAGES: ApplicationStatus[] = [
  "NEW",
  "REVIEWING",
  "PHONE_SCREEN",
  "INTERVIEW",
  "OFFER",
];

export const ALL_STAGES: ApplicationStatus[] = [...APPLICATION_STATUSES];

export const APPLICATION_SOURCES = [
  "CAREERS_PAGE",
  "LINKEDIN",
  "REFERRAL",
  "INDEED",
  "OTHER",
] as const;

export type ApplicationSource = (typeof APPLICATION_SOURCES)[number];

export const ApplicationSourceSchema = z.enum(APPLICATION_SOURCES);

/** Statuses that send automated applicant emails. */
export const EMAIL_TRIGGER_STATUSES = [
  "REJECTED",
  "PHONE_SCREEN",
  "INTERVIEW",
  "OFFER",
] as const;

export type EmailTriggerStatus = (typeof EMAIL_TRIGGER_STATUSES)[number];

export const EmailTriggerStatusSchema = z.enum(EMAIL_TRIGGER_STATUSES);

export const EMAIL_TRIGGERS: ReadonlySet<string> = new Set(EMAIL_TRIGGER_STATUSES);

export const DEFAULT_HIRING_POSITION = "EA_STARTUP_OPS_COORDINATOR";

export const POSITION_DISPLAY_NAMES: Record<string, string> = {
  EA_STARTUP_OPS_COORDINATOR: "Executive Assistant / Startup Operations Coordinator",
};

export function positionDisplayName(position: string): string {
  return POSITION_DISPLAY_NAMES[position] ?? position;
}

export const ApplicationNoteSchema = z.object({
  noteId: z.string().min(1),
  text: z.string().min(1).max(4000),
  authorName: z.string(),
  authorId: z.string().optional(),
  createdAt: z.string(),
  pinned: z.boolean().optional(),
});
export type ApplicationNote = z.infer<typeof ApplicationNoteSchema>;

export const ApplicationActivitySchema = z.object({
  activityId: z.string().min(1),
  type: z.enum(["status_change", "note_added", "resume_viewed", "assigned", "rating_set"]),
  description: z.string(),
  authorName: z.string(),
  createdAt: z.string(),
  metadata: z.record(z.string(), z.string()).optional(),
});
export type ApplicationActivity = z.infer<typeof ApplicationActivitySchema>;

export const JobApplicationSchema = z.object({
  applicationId: z.string().min(1),
  agencyId: z.literal("platform"),
  position: z.string().min(1),
  source: ApplicationSourceSchema,
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional(),
  linkedInUrl: z.union([z.string().url(), z.literal("")]).optional(),
  yearsExperience: z.string().optional(),
  weeklyAvailability: z.string().optional(),
  coverNote: z.string().optional(),
  resumeKey: z.string().optional(),
  resumeFileName: z.string().optional(),
  status: ApplicationStatusSchema,
  rating: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]).optional(),
  assignedTo: z.string().optional(),
  assignedToName: z.string().optional(),
  notes: z.array(ApplicationNoteSchema).optional(),
  activities: z.array(ApplicationActivitySchema).optional(),
  lastEmailStatus: z.string().optional(),
  lastEmailSentAt: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string().optional(),
});
export type JobApplication = z.infer<typeof JobApplicationSchema>;

export const careersPresignedUploadBodySchema = z.object({
  fileName: z.string().min(1).max(255),
  contentType: z.enum([
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ]),
});
export type CareersPresignedUploadBody = z.infer<typeof careersPresignedUploadBodySchema>;

export const careersApplyBodySchema = z.object({
  position: z.string().min(1).max(120).default(DEFAULT_HIRING_POSITION),
  firstName: z.string().min(1).max(80),
  lastName: z.string().min(1).max(80),
  email: z.string().email().max(254),
  phone: z.string().max(40).optional(),
  linkedInUrl: z.string().max(500).optional(),
  yearsExperience: z.string().max(40).optional(),
  weeklyAvailability: z.string().max(120).optional(),
  coverNote: z.string().min(20).max(5000).optional(),
  resumeKey: z.string().max(512).optional(),
  resumeFileName: z.string().max(255).optional(),
  source: ApplicationSourceSchema.default("CAREERS_PAGE"),
});
export type CareersApplyBody = z.infer<typeof careersApplyBodySchema>;

export const updateApplicationBodySchema = z.object({
  status: ApplicationStatusSchema.optional(),
  statusNote: z.string().max(2000).optional(),
  skipEmail: z.boolean().optional(),
  schedulingLink: z.union([z.string().url().max(1000), z.literal("")]).optional(),
  customMessage: z.string().max(2000).optional(),
  rating: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]).optional(),
  assignedTo: z.string().max(128).optional(),
  assignedToName: z.string().max(200).optional(),
});
export type UpdateApplicationBody = z.infer<typeof updateApplicationBodySchema>;

export const addApplicationNoteBodySchema = z.object({
  text: z.string().min(1).max(4000),
  pinned: z.boolean().optional(),
});
export type AddApplicationNoteBody = z.infer<typeof addApplicationNoteBodySchema>;

export type ApplicationStatusGroup = Record<ApplicationStatus, JobApplication[]>;

export const STATUS_CONFIG: Record<
  ApplicationStatus,
  { label: string; color: string; bgClass: string; textClass: string; boardBorder: string }
> = {
  NEW: {
    label: "New",
    color: "#38bdf8",
    bgClass: "bg-sky-500/15",
    textClass: "text-sky-300",
    boardBorder: "border-sky-500/30",
  },
  REVIEWING: {
    label: "Reviewing",
    color: "#a78bfa",
    bgClass: "bg-violet-500/15",
    textClass: "text-violet-300",
    boardBorder: "border-violet-500/30",
  },
  PHONE_SCREEN: {
    label: "Phone Screen",
    color: "#fb923c",
    bgClass: "bg-orange-500/15",
    textClass: "text-orange-300",
    boardBorder: "border-orange-500/30",
  },
  INTERVIEW: {
    label: "Interview",
    color: "#facc15",
    bgClass: "bg-yellow-500/15",
    textClass: "text-yellow-300",
    boardBorder: "border-yellow-500/30",
  },
  OFFER: {
    label: "Offer",
    color: "#34d399",
    bgClass: "bg-emerald-500/15",
    textClass: "text-emerald-300",
    boardBorder: "border-emerald-500/30",
  },
  HIRED: {
    label: "Hired",
    color: "#4ade80",
    bgClass: "bg-green-500/15",
    textClass: "text-green-300",
    boardBorder: "border-green-500/30",
  },
  REJECTED: {
    label: "Rejected",
    color: "#f87171",
    bgClass: "bg-red-500/15",
    textClass: "text-red-300",
    boardBorder: "border-red-500/30",
  },
  WITHDRAWN: {
    label: "Withdrawn",
    color: "#94a3b8",
    bgClass: "bg-slate-500/15",
    textClass: "text-slate-400",
    boardBorder: "border-slate-500/30",
  },
};
