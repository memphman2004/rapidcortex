import { z } from "zod";

/** Platform-owned conference catalog (not tenant-scoped). */
export const PLATFORM_CONFERENCE_AGENCY_ID = "platform";

export const conferenceChangeConfidenceSchema = z.enum(["confirmed", "likely", "possible"]);
export type ConferenceChangeConfidence = z.infer<typeof conferenceChangeConfidenceSchema>;

export const conferenceChangeTypeSchema = z.enum([
  "dates",
  "dates-announced",
  "location",
  "venue",
  "deadline",
  "cancelled",
  "new-info",
]);
export type ConferenceChangeType = z.infer<typeof conferenceChangeTypeSchema>;

export const conferenceChangeStatusSchema = z.enum(["pending", "applied", "dismissed"]);
export type ConferenceChangeStatus = z.infer<typeof conferenceChangeStatusSchema>;

export const conferenceChangeRecordSchema = z.object({
  changeId: z.string().min(1),
  detectedAt: z.string().min(1),
  changeType: conferenceChangeTypeSchema,
  previousValue: z.string(),
  newValue: z.string(),
  sourceUrl: z.string(),
  confidence: conferenceChangeConfidenceSchema,
  status: conferenceChangeStatusSchema.default("pending"),
});
export type ConferenceChangeRecord = z.infer<typeof conferenceChangeRecordSchema>;

export const conferenceVerticalSchema = z.enum(["911", "campus", "venue", "airport"]);
export type ConferenceVertical = z.infer<typeof conferenceVerticalSchema>;

/** Attendance: green = going, amber = maybe, red = not attending. */
export const conferencePrioritySchema = z.enum(["red", "amber", "green"]);
export type ConferencePriority = z.infer<typeof conferencePrioritySchema>;

export const conferenceSchema = z.object({
  conferenceId: z.string().min(1),
  agencyId: z.literal(PLATFORM_CONFERENCE_AGENCY_ID).default(PLATFORM_CONFERENCE_AGENCY_ID),
  name: z.string().min(1).max(200),
  website: z.string().url().optional().or(z.literal("")),
  sourceUrl: z.string().min(1).max(2000),
  alternateSourceUrls: z.array(z.string().url()).max(8).optional(),
  startDate: z.string().min(1).max(32),
  endDate: z.string().min(1).max(32).optional(),
  location: z.string().min(1).max(200),
  venue: z.string().max(200).optional(),
  registrationFee: z.string().max(160).optional(),
  boothFee: z.string().max(160).optional(),
  registrationDeadline: z.string().max(32).optional(),
  isCancelled: z.boolean().optional(),
  vertical: conferenceVerticalSchema.optional(),
  priority: conferencePrioritySchema.optional(),
  notes: z.string().max(2000).optional(),
  lastChecked: z.string().optional(),
  lastUpdated: z.string().optional(),
  lastChangeType: conferenceChangeTypeSchema.optional(),
  changeHistory: z.array(conferenceChangeRecordSchema).default([]),
  autoUpdateEnabled: z.boolean().default(true),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
});
export type Conference = z.infer<typeof conferenceSchema>;

export const extractedConferenceDataSchema = z.object({
  startDate: z.string().nullable(),
  endDate: z.string().nullable(),
  location: z.string().nullable(),
  venue: z.string().nullable(),
  registrationDeadline: z.string().nullable(),
  isCancelled: z.boolean(),
  isPostponed: z.boolean(),
  newDatesTBD: z.boolean(),
  confidence: conferenceChangeConfidenceSchema,
  rawDateText: z.string().nullable(),
  rawLocationText: z.string().nullable(),
  notes: z.string().nullable(),
});
export type ExtractedConferenceData = z.infer<typeof extractedConferenceDataSchema>;

export const createConferenceBodySchema = z.object({
  name: z.string().min(1).max(200),
  website: z.string().url().optional().or(z.literal("")),
  sourceUrl: z.string().min(1).max(2000).optional(),
  alternateSourceUrls: z.array(z.string().url()).max(8).optional(),
  startDate: z.string().min(1).max(32),
  endDate: z.string().min(1).max(32).optional(),
  location: z.string().min(1).max(200),
  venue: z.string().max(200).optional(),
  registrationFee: z.string().max(160).optional(),
  boothFee: z.string().max(160).optional(),
  registrationDeadline: z.string().max(32).optional(),
  vertical: conferenceVerticalSchema.optional(),
  priority: conferencePrioritySchema.optional(),
  notes: z.string().max(2000).optional(),
  autoUpdateEnabled: z.boolean().optional(),
});
export type CreateConferenceBody = z.infer<typeof createConferenceBodySchema>;

export const patchConferenceBodySchema = z.object({
  name: z.string().min(1).max(200).optional(),
  website: z.string().url().optional().or(z.literal("")),
  sourceUrl: z.string().min(1).max(2000).optional().or(z.literal("")),
  alternateSourceUrls: z.array(z.string().url()).max(8).optional(),
  startDate: z.string().min(1).max(32).optional(),
  endDate: z.string().min(1).max(32).optional(),
  location: z.string().min(1).max(200).optional(),
  venue: z.string().max(200).optional(),
  registrationFee: z.string().max(160).nullable().optional(),
  boothFee: z.string().max(160).nullable().optional(),
  registrationDeadline: z.string().max(32).nullable().optional(),
  isCancelled: z.boolean().optional(),
  vertical: conferenceVerticalSchema.optional(),
  priority: conferencePrioritySchema.optional(),
  notes: z.string().max(2000).optional(),
  autoUpdateEnabled: z.boolean().optional(),
  action: z.enum(["dismiss_change", "apply_change"]).optional(),
  changeId: z.string().min(1).optional(),
});
export type PatchConferenceBody = z.infer<typeof patchConferenceBodySchema>;

export const SIGNIFICANT_CONFERENCE_CHANGE_TYPES: readonly ConferenceChangeType[] = [
  "dates",
  "dates-announced",
  "location",
  "deadline",
  "cancelled",
];

export function isReliableConferenceConfidence(
  confidence: ConferenceChangeConfidence,
): boolean {
  return confidence === "confirmed" || confidence === "likely";
}

export function isSignificantConferenceChange(changeType: ConferenceChangeType): boolean {
  return (SIGNIFICANT_CONFERENCE_CHANGE_TYPES as readonly string[]).includes(changeType);
}

export function conferenceSourceUrl(conf: Pick<Conference, "sourceUrl" | "website">): string {
  const src = conf.sourceUrl?.trim();
  if (src) return src;
  return conf.website?.trim() ?? "";
}

export function pendingConferenceChanges(conf: Conference): ConferenceChangeRecord[] {
  return (conf.changeHistory ?? []).filter((c) => c.status === "pending");
}

export function conferencePriority(conf: Pick<Conference, "priority">): ConferencePriority {
  return conf.priority ?? "amber";
}
