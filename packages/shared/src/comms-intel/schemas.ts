import { z } from "zod";

export const contextCardDataSourceSchema = z.enum(["cad_only", "cad_and_vault", "vault_only"]);

export const contextCardLocationSchema = z.object({
  address: z.string(),
  normalizedAddress: z.string(),
  priorCalls12Months: z.number().int().nonnegative(),
  priorCallsAllTime: z.number().int().nonnegative(),
  callsByType: z.record(z.string(), z.number().int().nonnegative()),
  lastCallDate: z.string().nullable(),
  lastCallType: z.string().nullable(),
  daysSinceLastCall: z.number().int().nullable(),
  officerSafetyFlag: z.boolean(),
  officerSafetyNote: z.string().nullable(),
  activeRelatedIncidents: z.number().int().nonnegative(),
  dataSource: contextCardDataSourceSchema,
  recentCalls: z
    .array(
      z.object({
        date: z.string(),
        type: z.string(),
        disposition: z.string().optional(),
      }),
    )
    .max(10)
    .optional(),
});

export const contextCardCallerSchema = z.object({
  phone: z.string(),
  priorCallCount: z.number().int().nonnegative(),
  lastCallDate: z.string().nullable(),
  lastCallType: z.string().nullable(),
  knownAddresses: z.array(z.string()),
  agencyNotes: z.string().nullable(),
});

export const contextCardSchema = z.object({
  incidentId: z.string().min(1),
  agencyId: z.string().min(1),
  resolvedAt: z.string().datetime({ offset: true }).or(z.string().min(1)),
  location: contextCardLocationSchema,
  caller: contextCardCallerSchema.optional(),
});

export type ContextCard = z.infer<typeof contextCardSchema>;
export type ContextCardDataSource = z.infer<typeof contextCardDataSourceSchema>;

export const putSafetyFlagBodySchema = z.object({
  address: z.string().min(1).max(500),
  officerSafetyFlag: z.boolean(),
  officerSafetyNote: z.string().max(2000).nullable().optional(),
});

export type PutSafetyFlagBody = z.infer<typeof putSafetyFlagBodySchema>;

export const commandSummaryQuerySchema = z.object({
  date: z.string().optional(),
  range: z.enum(["today", "7d", "30d", "custom"]).optional(),
  from: z.string().optional(),
  to: z.string().optional(),
});

export const commandSummarySchema = z.object({
  agencyId: z.string(),
  date: z.string(),
  range: z.string(),
  total911Calls: z.number().int().nonnegative(),
  totalNonEmergencyCalls: z.number().int().nonnegative(),
  callAssistContainmentRate: z.number().min(0).max(1).nullable(),
  aiToHumanTransferRate: z.number().min(0).max(1).nullable(),
  averageAnswerTime911Sec: z.number().nullable(),
  averageAnswerTimeNonEmergencySec: z.number().nullable(),
  translationUsageByLanguage: z.record(z.string(), z.number().int().nonnegative()),
  cadWritebackSuccessRate: z.number().min(0).max(1).nullable(),
  dispatcherWorkload: z.record(z.string(), z.number().int().nonnegative()),
  callsByType: z.record(z.string(), z.number().int().nonnegative()),
  repeatLocations: z
    .array(
      z.object({
        address: z.string(),
        normalizedAddress: z.string(),
        callCount: z.number().int().nonnegative(),
        dominantType: z.string().optional(),
        daysSinceLastCall: z.number().int().nullable().optional(),
      }),
    )
    .optional(),
});

export type CommandSummary = z.infer<typeof commandSummarySchema>;

export const vaultUploadUrlBodySchema = z.object({
  fileName: z.string().min(1).max(255),
  contentType: z.string().min(1).max(128).default("text/csv"),
  sourceSystem: z
    .enum([
      "generic",
      "motorola-premierone",
      "tyler-new-world",
      "centralsquare",
      "hexagon",
      "zetron",
    ])
    .default("generic"),
});

export type VaultUploadUrlBody = z.infer<typeof vaultUploadUrlBodySchema>;

export const vaultSearchQuerySchema = z.object({
  q: z.string().optional(),
  addr: z.string().optional(),
  type: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  cursor: z.string().optional(),
});

export const vaultIngestionJobSchema = z.object({
  jobId: z.string(),
  agencyId: z.string(),
  status: z.enum(["pending", "processing", "completed", "failed"]),
  sourceSystem: z.string(),
  fileName: z.string().optional(),
  recordCount: z.number().int().nonnegative().optional(),
  errorCount: z.number().int().nonnegative().optional(),
  errorSummary: z.record(z.string(), z.number().int()).optional(),
  dateRangeStart: z.string().nullable().optional(),
  dateRangeEnd: z.string().nullable().optional(),
  submittedBy: z.string().optional(),
  createdAt: z.string(),
  completedAt: z.string().nullable().optional(),
});

export type VaultIngestionJob = z.infer<typeof vaultIngestionJobSchema>;

export const vaultIncidentSchema = z.object({
  sourceIncidentId: z.string(),
  sourceSystem: z.string(),
  callDate: z.string(),
  callTime: z.string().optional(),
  callType: z.string().optional(),
  address: z.string().optional(),
  normalizedAddress: z.string().optional(),
  disposition: z.string().optional(),
  narrative: z.string().optional(),
  phone: z.string().optional(),
});

export type VaultIncident = z.infer<typeof vaultIncidentSchema>;
