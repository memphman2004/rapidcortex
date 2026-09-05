import { z } from "zod";
import type { CampusSite } from "./campus-sites.js";

export const campusThreatLevelSchema = z.enum(["secure", "elevated", "high_alert", "lockdown"]);
export type CampusThreatLevel = z.infer<typeof campusThreatLevelSchema>;

export const campusZoneStatusSchema = z.enum(["clear", "active", "elevated"]);
export const campusBuildingStatusSchema = z.enum(["nominal", "alert", "closed"]);
export const campusStaffDutyStatusSchema = z.enum(["available", "en_route", "on_scene"]);

export const campusNotificationAudienceSchema = z.enum([
  "all_students",
  "all_staff",
  "by_building",
  "by_zone",
]);
export const campusNotificationPrioritySchema = z.enum(["standard", "emergency"]);

export const campusNotificationBodySchema = z
  .object({
    audience: campusNotificationAudienceSchema,
    buildingId: z.string().trim().max(64).optional(),
    zoneId: z.string().trim().max(64).optional(),
    message: z.string().trim().min(1).max(2000),
    priority: campusNotificationPrioritySchema,
  })
  .strict()
  .superRefine((v, ctx) => {
    if (v.audience === "by_building" && !v.buildingId?.trim()) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "buildingId required", path: ["buildingId"] });
    }
    if (v.audience === "by_zone" && !v.zoneId?.trim()) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "zoneId required", path: ["zoneId"] });
    }
  });

export const campusBroadcastBodySchema = z
  .object({
    message: z.string().trim().min(1).max(2000),
    channels: z.array(z.enum(["sms", "email", "push"])).min(1).max(3),
  })
  .strict();

export const campusThreatLevelPatchSchema = z
  .object({
    level: campusThreatLevelSchema,
  })
  .strict();

export type CampusStatsResponse = {
  activeIncidents: number;
  respondersOnDuty: number;
  buildingsMonitored: number;
  alertsSentToday: number;
  /** Every campus this tenant operates. Always includes the system campus code. */
  sites: CampusSite[];
  primarySiteCode: string;
};

export type CampusZoneSummary = {
  zoneId: string;
  zoneName: string;
  incidentCount: number;
  responderCount: number;
  status: z.infer<typeof campusZoneStatusSchema>;
  siteCode?: string;
};

export type CampusBuildingSummary = {
  buildingId: string;
  buildingName: string;
  zone: string;
  occupancy: number | null;
  status: z.infer<typeof campusBuildingStatusSchema>;
  activeIncidents: number;
  siteCode?: string;
};

export type CampusThreatLevelState = {
  level: CampusThreatLevel;
  setAt: string;
  setBy: string;
};

export type CampusOnDutyStaff = {
  userId: string;
  displayName: string;
  initials: string;
  role: string;
  zone: string;
  status: z.infer<typeof campusStaffDutyStatusSchema>;
};

export type CampusNotificationBody = z.infer<typeof campusNotificationBodySchema>;
export type CampusBroadcastBody = z.infer<typeof campusBroadcastBodySchema>;
