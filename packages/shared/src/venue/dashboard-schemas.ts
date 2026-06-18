import { z } from "zod";

export const venueNotificationAudienceSchema = z.enum([
  "all_security",
  "by_section",
  "by_gate",
]);
export const venueNotificationPrioritySchema = z.enum(["standard", "emergency"]);

export const venueNotificationBodySchema = z
  .object({
    audience: venueNotificationAudienceSchema,
    sectionId: z.string().trim().max(64).optional(),
    message: z.string().trim().min(1).max(2000),
    priority: venueNotificationPrioritySchema,
  })
  .strict()
  .superRefine((v, ctx) => {
    if (v.audience === "by_section" && !v.sectionId?.trim()) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "sectionId required", path: ["sectionId"] });
    }
  });

export type VenueStatsResponse = {
  activeIncidents: number;
  securityOnDuty: number;
  sectionsMonitored: number;
  guestReportsToday: number;
};

export type VenueSectionSummary = {
  sectionId: string;
  sectionName: string;
  gate: string;
  level: string;
  capacity: number;
  incidentCount: number;
  status: string;
};

export type VenueEventsResponse = {
  currentEvent: {
    name: string;
    startedAt: string;
    capacity: number;
    status: string;
  } | null;
  upcomingEvents: Array<{
    name: string;
    startsAt: string;
    capacity?: number;
  }>;
};

export type VenueOnDutyStaff = {
  userId: string;
  displayName: string;
  initials: string;
  role: string;
  zone: string;
  status: "available" | "en_route" | "on_scene";
};

export type VenueNotificationBody = z.infer<typeof venueNotificationBodySchema>;
