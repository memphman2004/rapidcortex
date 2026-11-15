import { z } from "zod";

/** Canonical marketing measurement ID (live gtag / GTM). Not the GA4 numeric property ID. */
export const MARKETING_GA_MEASUREMENT_ID = "G-NGT17QK1LW";
export const MARKETING_GTM_ID = "GTM-M33PD9HM";
export const MARKETING_WEBSITE_ORIGIN = "https://www.nexcortiq.us";
/** Preferred Search Console property — domain property when verified. */
export const MARKETING_GSC_SITE_URL = "sc-domain:nexcortiq.us";
export const MARKETING_GA4_SECRET_NAME = "rapid-cortex/marketing/ga4-service-account";

/** Category / head queries to monitor in Search Console. */
export const MARKETING_MONITORED_SEARCH_QUERIES = [
  "AI public safety software",
  "public safety software",
  "911 dispatch software",
  "PSAP software",
  "campus safety software",
  "venue security software",
  "transit safety software",
  "non emergency call handling",
] as const;

/** Recommended lead events — emit from site; mark as key events only with explicit approval. */
export const MARKETING_LEAD_EVENT_NAMES = [
  "generate_lead",
  "demo_request",
  "pilot_application",
  "quote_request",
  "calculator_completed",
  "assessment_completed",
  "newsletter_signup",
] as const;

export const MarketingSeoSourceStatusSchema = z.enum([
  "ok",
  "secret_missing",
  "authorization_required",
  "misconfigured",
  "error",
  "mock",
]);
export type MarketingSeoSourceStatus = z.infer<typeof MarketingSeoSourceStatusSchema>;

export const MarketingSeoQueryRowSchema = z.object({
  query: z.string(),
  clicks: z.number(),
  impressions: z.number(),
  ctr: z.number(),
  position: z.number(),
});
export type MarketingSeoQueryRow = z.infer<typeof MarketingSeoQueryRowSchema>;

export const MarketingSeoPageRowSchema = z.object({
  page: z.string(),
  clicks: z.number(),
  impressions: z.number(),
  ctr: z.number(),
  position: z.number(),
});
export type MarketingSeoPageRow = z.infer<typeof MarketingSeoPageRowSchema>;

export const MarketingSeoMetricsDataSchema = z.object({
  syncedAt: z.string(),
  website: z.string(),
  measurementId: z.string(),
  gtmId: z.string().optional(),
  gscSiteUrl: z.string().optional(),
  ga4PropertyId: z.string().optional(),
  search: z
    .object({
      status: MarketingSeoSourceStatusSchema,
      error: z.string().optional(),
      lastSyncAt: z.string().optional(),
      rangeDays: z.number(),
      totals: z
        .object({
          clicks: z.number(),
          impressions: z.number(),
          ctr: z.number(),
          position: z.number(),
        })
        .optional(),
      topQueries: z.array(MarketingSeoQueryRowSchema).default([]),
      monitoredQueries: z.array(MarketingSeoQueryRowSchema).default([]),
      lowCtrPages: z.array(MarketingSeoPageRowSchema).default([]),
      sitemaps: z
        .array(
          z.object({
            path: z.string(),
            lastSubmitted: z.string().optional(),
            isPending: z.boolean().optional(),
            errors: z.number().optional(),
          }),
        )
        .default([]),
    })
    .optional(),
  analytics: z
    .object({
      status: MarketingSeoSourceStatusSchema,
      error: z.string().optional(),
      lastSyncAt: z.string().optional(),
      rangeDays: z.number(),
      sessions: z.number().optional(),
      users: z.number().optional(),
      landingPages: z
        .array(
          z.object({
            pagePath: z.string(),
            sessions: z.number(),
            users: z.number(),
          }),
        )
        .default([]),
      aiReferrals: z
        .array(
          z.object({
            source: z.string(),
            sessions: z.number(),
          }),
        )
        .default([]),
      leadEvents: z
        .array(
          z.object({
            eventName: z.string(),
            eventCount: z.number(),
          }),
        )
        .default([]),
      keyEventsConfigured: z.array(z.string()).default([]),
      streams: z
        .array(
          z.object({
            name: z.string(),
            measurementId: z.string().optional(),
            defaultUri: z.string().optional(),
          }),
        )
        .default([]),
    })
    .optional(),
  crm: z
    .object({
      demoRequests: z.number(),
      qualifiedLeads: z.number(),
      totalLeads: z.number(),
      conversionRate: z.number().optional(),
    })
    .optional(),
  authorization: z
    .object({
      serviceAccountEmail: z.string().optional(),
      requiredGrants: z.array(z.string()).default([]),
    })
    .optional(),
});
export type MarketingSeoMetricsData = z.infer<typeof MarketingSeoMetricsDataSchema>;

export const MarketingSeoMetricsResponseSchema = z.object({
  success: z.boolean(),
  data: MarketingSeoMetricsDataSchema,
});
export type MarketingSeoMetricsResponse = z.infer<typeof MarketingSeoMetricsResponseSchema>;
