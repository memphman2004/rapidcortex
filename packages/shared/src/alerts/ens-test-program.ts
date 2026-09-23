import { z } from "zod";
import {
  alertChannelSchema,
  alertVerticalSchema,
  isConfirmDispatchToken,
  type AlertChannel,
  type AlertVertical,
} from "./schemas.js";

export const ENS_ONE_MILE_BUFFER_METERS = 1609.344;

export const ensTestKindSchema = z.enum([
  "monthly_silent",
  "semester_audible",
  "annual_comprehensive",
]);
export type EnsTestKind = z.infer<typeof ensTestKindSchema>;

export const ENS_TEST_KIND_LABELS: Record<EnsTestKind, string> = {
  monthly_silent: "Monthly silent test",
  semester_audible: "Semester audible test",
  annual_comprehensive: "Annual comprehensive test",
};

export const ensTestKindToTemplateType = {
  monthly_silent: "ENS_TEST_MONTHLY_SILENT",
  semester_audible: "ENS_TEST_SEMESTER_AUDIBLE",
  annual_comprehensive: "ENS_TEST_ANNUAL_COMPREHENSIVE",
} as const;

export type EnsTestTemplateType = (typeof ensTestKindToTemplateType)[EnsTestKind];

export const fourwindsDisplayScopeSchema = z.object({
  scopeType: z.enum(["campus", "building", "zone"]),
  scopeId: z.string().trim().min(1).max(128),
  label: z.string().trim().max(200).optional(),
});
export type FourwindsDisplayScope = z.infer<typeof fourwindsDisplayScopeSchema>;

const ensScheduleSlotSchema = z.object({
  enabled: z.boolean(),
  /** Local wall-clock hour 0–23 */
  hourLocal: z.number().int().min(0).max(23).default(10),
  minuteLocal: z.number().int().min(0).max(59).default(0),
});

export const ensMonthlySilentScheduleSchema = ensScheduleSlotSchema.extend({
  /** Day of month (1–28 recommended for all months) */
  dayOfMonth: z.number().int().min(1).max(28).default(1),
});

export const ensSemesterAudibleScheduleSchema = ensScheduleSlotSchema.extend({
  springMonth: z.number().int().min(1).max(12).default(2),
  springDay: z.number().int().min(1).max(28).default(15),
  fallMonth: z.number().int().min(1).max(12).default(9),
  fallDay: z.number().int().min(1).max(28).default(15),
});

export const ensAnnualComprehensiveScheduleSchema = ensScheduleSlotSchema.extend({
  month: z.number().int().min(1).max(12).default(9),
  day: z.number().int().min(1).max(28).default(20),
});

export const ensTestProgramSchema = z.object({
  agencyId: z.string().min(1).max(128),
  vertical: alertVerticalSchema,
  timezone: z.string().trim().min(1).max(64).default("America/Indiana/Indianapolis"),
  institutionName: z.string().trim().min(1).max(200),
  securityContactPhone: z.string().trim().max(32).optional(),
  monthlySilent: ensMonthlySilentScheduleSchema,
  semesterAudible: ensSemesterAudibleScheduleSchema,
  annualComprehensive: ensAnnualComprehensiveScheduleSchema,
  defaultGroupSlugs: z.array(z.string().trim().min(1).max(80)).min(1).max(16),
  defaultChannels: z.array(alertChannelSchema).min(1).max(6),
  fourwindsEnabled: z.boolean().default(true),
  fourwindsScopes: z.array(fourwindsDisplayScopeSchema).max(64).default([]),
  html5FallbackUrl: z.string().url().max(2000).optional(),
  paSirenEnabled: z.boolean().default(true),
  includeOneMileRingInScope: z.boolean().default(true),
  lastRunAt: z
    .object({
      monthly_silent: z.string().optional(),
      semester_audible: z.string().optional(),
      annual_comprehensive: z.string().optional(),
    })
    .default({}),
  updatedAt: z.string(),
  createdAt: z.string(),
});
export type EnsTestProgram = z.infer<typeof ensTestProgramSchema>;

export const ensSiteBoundarySchema = z.object({
  agencyId: z.string().min(1).max(128),
  vertical: alertVerticalSchema,
  /** Primary campus/venue property boundary (lng/lat ring) */
  boundaryPolygon: z.array(z.tuple([z.number(), z.number()])).min(3).max(1000),
  /** Computed 1-mile outer ring (stored for reporting + geofence sync) */
  outerRingOneMile: z.array(z.tuple([z.number(), z.number()])).min(3).max(1000),
  geofenceBoundaryZoneId: z.string().default("ens-property-boundary"),
  geofenceOuterZoneId: z.string().default("ens-one-mile-ring"),
  updatedAt: z.string(),
  createdAt: z.string(),
});
export type EnsSiteBoundary = z.infer<typeof ensSiteBoundarySchema>;

export const ensTestRunSchema = z.object({
  runId: z.string().min(1).max(128),
  agencyId: z.string().min(1).max(128),
  vertical: alertVerticalSchema,
  kind: ensTestKindSchema,
  jobId: z.string().min(1).max(128),
  initiatedAt: z.string(),
  completedAt: z.string().optional(),
  scopeDescription: z.string().min(1).max(4000),
  channels: z.array(alertChannelSchema).min(1).max(6),
  channelSummary: z.array(
    z.object({
      channel: alertChannelSchema,
      queued: z.number().int().nonnegative(),
      sent: z.number().int().nonnegative(),
      delivered: z.number().int().nonnegative(),
      failed: z.number().int().nonnegative(),
      skipped: z.number().int().nonnegative(),
      skipReason: z.string().max(500).optional(),
    }),
  ),
  failures: z.array(z.string().max(500)).default([]),
  actorId: z.string().min(1).max(128),
  scheduled: z.boolean().default(false),
});
export type EnsTestRun = z.infer<typeof ensTestRunSchema>;

export const ensTestProgramUpsertBodySchema = ensTestProgramSchema
  .omit({
    agencyId: true,
    createdAt: true,
    updatedAt: true,
    lastRunAt: true,
  })
  .partial({
    monthlySilent: true,
    semesterAudible: true,
    annualComprehensive: true,
    defaultGroupSlugs: true,
    defaultChannels: true,
    fourwindsScopes: true,
  })
  .extend({
    vertical: alertVerticalSchema,
  })
  .strict();

export const ensSiteBoundaryUpsertBodySchema = z
  .object({
    vertical: alertVerticalSchema,
    boundaryPolygon: z.array(z.tuple([z.number(), z.number()])).min(3).max(1000),
  })
  .strict();

export const ensManualRunBodySchema = z
  .object({
    vertical: alertVerticalSchema,
    kind: ensTestKindSchema,
    confirmation: z.string().min(1).max(32),
    confirmationToken: z.string().min(1).max(32).optional(),
  })
  .strict()
  .refine((v) => isConfirmDispatchToken(v.confirmation ?? v.confirmationToken), {
    message: "Type CONFIRM to run an ENS test",
    path: ["confirmation"],
  });

export function defaultEnsTestProgram(vertical: AlertVertical, agencyId: string, name: string): EnsTestProgram {
  const now = new Date().toISOString();
  const channels: AlertChannel[] = ["WEB_DASHBOARD", "SMS", "DISPLAY_TAKEOVER", "PA_SIREN"];
  return {
    agencyId,
    vertical,
    timezone: "America/Indiana/Indianapolis",
    institutionName: name,
    monthlySilent: { enabled: true, dayOfMonth: 1, hourLocal: 10, minuteLocal: 0 },
    semesterAudible: {
      enabled: true,
      springMonth: 2,
      springDay: 15,
      fallMonth: 9,
      fallDay: 15,
      hourLocal: 10,
      minuteLocal: 0,
    },
    annualComprehensive: { enabled: true, month: 9, day: 20, hourLocal: 10, minuteLocal: 0 },
    defaultGroupSlugs: vertical === "venue" ? ["all-occupants"] : ["all"],
    defaultChannels: channels,
    fourwindsEnabled: true,
    fourwindsScopes: [],
    paSirenEnabled: true,
    includeOneMileRingInScope: true,
    lastRunAt: {},
    createdAt: now,
    updatedAt: now,
  };
}

type ZonedParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
};

function zonedParts(iso: string, timeZone: string): ZonedParts {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    hour12: false,
  });
  const parts = fmt.formatToParts(new Date(iso));
  const pick = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((p) => p.type === type)?.value ?? "0");
  return {
    year: pick("year"),
    month: pick("month"),
    day: pick("day"),
    hour: pick("hour"),
    minute: pick("minute"),
  };
}

function sameLocalMonth(a: string, b: string, tz: string): boolean {
  const pa = zonedParts(a, tz);
  const pb = zonedParts(b, tz);
  return pa.year === pb.year && pa.month === pb.month;
}

function sameLocalYear(a: string, b: string, tz: string): boolean {
  return zonedParts(a, tz).year === zonedParts(b, tz).year;
}

function atOrPastSchedule(nowIso: string, tz: string, hour: number, minute: number): boolean {
  const p = zonedParts(nowIso, tz);
  if (p.hour > hour) return true;
  if (p.hour === hour && p.minute >= minute) return true;
  return false;
}

/** Returns kinds that should fire for the given program at `nowIso` (scheduler / dry-run). */
export function ensTestKindsDue(program: EnsTestProgram, nowIso: string): EnsTestKind[] {
  if (program.vertical === "transit") return [];
  const due: EnsTestKind[] = [];
  const tz = program.timezone;

  if (program.monthlySilent.enabled) {
    const p = zonedParts(nowIso, tz);
    const last = program.lastRunAt.monthly_silent;
    if (
      p.day === program.monthlySilent.dayOfMonth &&
      atOrPastSchedule(nowIso, tz, program.monthlySilent.hourLocal, program.monthlySilent.minuteLocal) &&
      (!last || !sameLocalMonth(last, nowIso, tz))
    ) {
      due.push("monthly_silent");
    }
  }

  if (program.semesterAudible.enabled) {
    const p = zonedParts(nowIso, tz);
    const last = program.lastRunAt.semester_audible;
    const spring =
      p.month === program.semesterAudible.springMonth &&
      p.day === program.semesterAudible.springDay &&
      atOrPastSchedule(
        nowIso,
        tz,
        program.semesterAudible.hourLocal,
        program.semesterAudible.minuteLocal,
      );
    const fall =
      p.month === program.semesterAudible.fallMonth &&
      p.day === program.semesterAudible.fallDay &&
      atOrPastSchedule(
        nowIso,
        tz,
        program.semesterAudible.hourLocal,
        program.semesterAudible.minuteLocal,
      );
    if ((spring || fall) && (!last || !sameLocalYear(last, nowIso, tz))) {
      due.push("semester_audible");
    }
  }

  if (program.annualComprehensive.enabled) {
    const p = zonedParts(nowIso, tz);
    const last = program.lastRunAt.annual_comprehensive;
    if (
      p.month === program.annualComprehensive.month &&
      p.day === program.annualComprehensive.day &&
      atOrPastSchedule(
        nowIso,
        tz,
        program.annualComprehensive.hourLocal,
        program.annualComprehensive.minuteLocal,
      ) &&
      (!last || !sameLocalYear(last, nowIso, tz))
    ) {
      due.push("annual_comprehensive");
    }
  }

  return due;
}

export function ensScopeDescription(params: {
  program: EnsTestProgram;
  kind: EnsTestKind;
  boundaryConfigured: boolean;
}): string {
  const base = `${ENS_TEST_KIND_LABELS[params.kind]} for ${params.program.institutionName}.`;
  const ring = params.program.includeOneMileRingInScope
    ? " Alert scope includes registered occupants campus-wide plus the 1-mile ring outside the property boundary (Clery-aligned off-campus notification zone)."
    : " Alert scope includes registered occupant groups configured for this institution.";
  const boundary = params.boundaryConfigured
    ? " Property boundary polygon is on file for geofence and display targeting."
    : " Property boundary not yet configured — upload boundary to enable 1-mile ring geofencing.";
  const fw =
    params.program.fourwindsEnabled && params.program.fourwindsScopes.length > 0
      ? ` Four Winds display takeover scopes: ${params.program.fourwindsScopes.map((s) => `${s.scopeType}:${s.scopeId}`).join(", ")}.`
      : params.program.fourwindsEnabled
        ? " Four Winds display takeover enabled (default campus scope)."
        : "";
  return `${base}${ring}${boundary}${fw}`;
}
