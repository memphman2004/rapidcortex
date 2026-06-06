import { z } from "zod";

/** Severity for actionable SEO findings stored per agency. */
export const seoIssueSeveritySchema = z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]);
export type SeoIssueSeverity = z.infer<typeof seoIssueSeveritySchema>;

export const seoIssueStatusSchema = z.enum(["OPEN", "FIXED", "IGNORED"]);
export type SeoIssueStatus = z.infer<typeof seoIssueStatusSchema>;

export const seoScanStatusSchema = z.enum(["pending", "running", "completed", "failed"]);
export type SeoScanStatus = z.infer<typeof seoScanStatusSchema>;

/** Score buckets returned by the analyzer (0–100 each; overall is weighted composite). */
export const seoCategoryScoresSchema = z.object({
  metadata: z.number().min(0).max(100),
  headings: z.number().min(0).max(100),
  contentQuality: z.number().min(0).max(100),
  technicalSeo: z.number().min(0).max(100),
  links: z.number().min(0).max(100),
  images: z.number().min(0).max(100),
  schema: z.number().min(0).max(100),
  performanceReadiness: z.number().min(0).max(100),
});
export type SeoCategoryScores = z.infer<typeof seoCategoryScoresSchema>;

export const seoIssueRecordSchema = z.object({
  id: z.string().min(1),
  agencyId: z.string().min(1),
  url: z.string().url(),
  severity: seoIssueSeveritySchema,
  issueType: z.string().min(1),
  description: z.string(),
  recommendation: z.string(),
  status: seoIssueStatusSchema,
  scanId: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type SeoIssueRecord = z.infer<typeof seoIssueRecordSchema>;

export const seoScanRecordSchema = z.object({
  id: z.string().min(1),
  agencyId: z.string().min(1),
  url: z.string().url(),
  pageTitle: z.string(),
  metaDescription: z.string(),
  h1: z.string(),
  score: z.number().min(0).max(100),
  categoryScores: seoCategoryScoresSchema,
  /** Serialized findings + recommendations from analyzer */
  issues: z.array(z.record(z.string(), z.unknown())).optional(),
  recommendations: z.array(z.string()).optional(),
  keywords: z.array(z.string()).optional(),
  schemaDetected: z.array(z.string()).optional(),
  brokenLinks: z.array(z.string()).optional(),
  scanStatus: seoScanStatusSchema,
  /** Automation / schedule hint */
  scanSchedule: z.enum(["manual", "daily", "weekly"]).optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type SeoScanRecord = z.infer<typeof seoScanRecordSchema>;

export const postSeoScanBodySchema = z.object({
  url: z.string().url(),
  keywords: z.array(z.string()).optional(),
  schedule: z.enum(["manual", "daily", "weekly"]).optional(),
});
export type PostSeoScanBody = z.infer<typeof postSeoScanBodySchema>;

export const patchSeoIssueBodySchema = z.object({
  status: seoIssueStatusSchema,
});
export type PatchSeoIssueBody = z.infer<typeof patchSeoIssueBodySchema>;

export const keywordIntelBodySchema = z.object({
  url: z.string().url(),
  keywords: z.array(z.string()).min(1),
});
export type KeywordIntelBody = z.infer<typeof keywordIntelBodySchema>;

export const seoSuggestionsBodySchema = z.object({
  url: z.string().url(),
  keywords: z.array(z.string()).optional(),
  context: z.string().max(8000).optional(),
});
export type SeoSuggestionsBody = z.infer<typeof seoSuggestionsBodySchema>;

export const schemaGenerateBodySchema = z.object({
  type: z.enum([
    "Organization",
    "SoftwareApplication",
    "Product",
    "FAQPage",
    "LocalBusiness",
    "Article",
    "BreadcrumbList",
  ]),
  payload: z.record(z.unknown()),
});
export type SchemaGenerateBody = z.infer<typeof schemaGenerateBodySchema>;

export const competitorOutlineBodySchema = z.object({
  topicId: z.enum([
    "rapid-cortex-vs-legacy-cad",
    "rapid-cortex-vs-ng911-media-only",
    "rc-lite-api-cad-vendors",
    "emergency-response-intelligence",
    "911-dispatcher-decision-support",
  ]),
});
export type CompetitorOutlineBody = z.infer<typeof competitorOutlineBodySchema>;
