import { z } from "zod";

/** Call-processing style metrics for RC-owned surfaces (inspired by NENA-STA-019). */
export const ng911MetricPeriodSchema = z.object({
  from: z.string().min(20),
  to: z.string().min(20),
});

export const ng911CallProcessingMetricsSchema = z.object({
  agencyId: z.string(),
  period: ng911MetricPeriodSchema,
  diversion: z.object({
    sessionsStarted: z.number().int().min(0),
    matched: z.number().int().min(0),
    smsSent: z.number().int().min(0),
    optedOutToLive: z.number().int().min(0),
    noMatch: z.number().int().min(0),
    avgHandleMs: z.number().min(0).optional(),
  }),
  triage: z.object({
    classified: z.number().int().min(0),
    nonEmergencyQueued: z.number().int().min(0),
    escalated: z.number().int().min(0),
    overridden: z.number().int().min(0),
  }),
  assist: z.object({
    transcriptAppends: z.number().int().min(0),
    eidoExports: z.number().int().min(0),
    eidoImports: z.number().int().min(0),
    additionalDataPackages: z.number().int().min(0),
    silentTextSessions: z.number().int().min(0),
    videoAssistStarts: z.number().int().min(0),
  }),
  crisis: z
    .object({
      assessmentsStarted: z.number().int().min(0),
      hardStops: z.number().int().min(0),
      byDestination: z.record(z.string(), z.number().int().min(0)),
      warmTransfers: z.number().int().min(0),
      warmTransfersCompleted: z.number().int().min(0),
      clinicianConsults: z.number().int().min(0),
      clinicianCompleted: z.number().int().min(0),
      phoneResolved: z.number().int().min(0),
      divertedFromLe: z.number().int().min(0),
      divertedFromEms: z.number().int().min(0),
      estimatedSavingsUsd: z.number().min(0).optional(),
    })
    .optional(),
  generatedAt: z.string().min(20),
});
export type Ng911CallProcessingMetrics = z.infer<typeof ng911CallProcessingMetricsSchema>;

export const ngSecControlStatusSchema = z.enum([
  "implemented",
  "partial",
  "planned",
  "not_applicable",
  "unknown",
]);

export const ngSecControlEvidenceSchema = z.object({
  controlId: z.string().min(1).max(64),
  title: z.string().min(1).max(200),
  category: z.string().min(1).max(80),
  status: ngSecControlStatusSchema,
  evidence: z.string().max(4000),
  references: z.array(z.string().max(300)).max(20).optional(),
});
export type NgSecControlEvidence = z.infer<typeof ngSecControlEvidenceSchema>;

export const ngSecEvidencePackSchema = z.object({
  agencyId: z.string(),
  packVersion: z.string().default("RC-NG-SEC-1.0"),
  generatedAt: z.string().min(20),
  disclaimer:
    z.string().default(
      "This pack maps Rapid Cortex controls to NG-SEC themes for RFP evidence. It does not claim NENA NG-SEC certification or CJIS accreditation.",
    ),
  controls: z.array(ngSecControlEvidenceSchema).min(1),
  metricsSnapshot: ng911CallProcessingMetricsSchema.optional(),
});
export type NgSecEvidencePack = z.infer<typeof ngSecEvidencePackSchema>;

export const ng911MetricsQuerySchema = z.object({
  from: z.string().min(20).optional(),
  to: z.string().min(20).optional(),
});
