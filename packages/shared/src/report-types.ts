import { z } from "zod";

export const reportTypeSchema = z.enum([
  "call_volume",
  "response_times",
  "sla_compliance",
  "dispatcher_performance",
  "incident_summary",
  "qa_scores",
  "translation_usage",
  "media_usage",
]);

export type ReportType = z.infer<typeof reportTypeSchema>;

export const reportDateRangeSchema = z.object({
  start: z.string().datetime(),
  end: z.string().datetime(),
});

export const reportConfigSchema = z.object({
  reportId: z.string().min(1),
  agencyId: z.string().min(1),
  type: reportTypeSchema,
  name: z.string().min(1).max(200),
  dateRange: reportDateRangeSchema,
  filters: z.record(z.unknown()),
  createdBy: z.string().min(1),
  createdAt: z.string().datetime(),
});

export type ReportConfig = z.infer<typeof reportConfigSchema>;

export const reportResultSchema = z.object({
  reportId: z.string().min(1),
  config: reportConfigSchema,
  rows: z.array(z.record(z.unknown())),
  summary: z.record(z.number()),
  generatedAt: z.string().datetime(),
});

export type ReportResult = z.infer<typeof reportResultSchema>;

export const generateReportBodySchema = z.object({
  type: reportTypeSchema,
  name: z.string().min(1).max(200),
  dateRange: reportDateRangeSchema,
  filters: z.record(z.unknown()).optional(),
});

export type GenerateReportBody = z.infer<typeof generateReportBodySchema>;

export const reportExportQuerySchema = z.object({
  format: z.enum(["csv", "json"]).default("json"),
});

export const REPORT_TYPE_LABELS: Record<ReportType, string> = {
  call_volume: "Call volume",
  response_times: "Response times",
  sla_compliance: "SLA compliance",
  dispatcher_performance: "Dispatcher performance",
  incident_summary: "Incident summary",
  qa_scores: "QA scores",
  translation_usage: "Translation usage",
  media_usage: "Media usage",
};
