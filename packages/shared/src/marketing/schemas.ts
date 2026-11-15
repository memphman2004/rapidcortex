import { z } from "zod";

/** Personal inbox domains rejected for Inside iQ business-email capture. */
export const MARKETING_BLOCKED_EMAIL_DOMAINS = [
  "gmail.com",
  "yahoo.com",
  "hotmail.com",
  "outlook.com",
  "icloud.com",
  "aol.com",
  "protonmail.com",
  "me.com",
] as const;

export function isMarketingBusinessEmail(email: string): boolean {
  const trimmed = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return false;
  const domain = trimmed.split("@")[1] ?? "";
  return !(MARKETING_BLOCKED_EMAIL_DOMAINS as readonly string[]).includes(domain);
}

export const marketingLeadBodySchema = z
  .object({
    firstName: z.string().trim().min(1, "Required").max(100),
    lastName: z.string().trim().min(1, "Required").max(100),
    email: z
      .string()
      .trim()
      .min(1, "Required")
      .email("Invalid email address")
      .max(320)
      .transform((v) => v.toLowerCase())
      .refine(isMarketingBusinessEmail, { message: "Please use a business email address" }),
    state: z.string().trim().min(1, "Required").max(100),
    referrer: z.string().max(2000).nullable().optional(),
    landingPage: z.string().max(500).optional(),
    capturedAt: z.string().max(64).optional(),
    utmSource: z.string().max(200).optional(),
    utmMedium: z.string().max(200).optional(),
    utmCampaign: z.string().max(200).optional(),
    utmContent: z.string().max(200).optional(),
  })
  .strict();

export type MarketingLeadBody = z.infer<typeof marketingLeadBodySchema>;

export type MarketingLeadFormValues = {
  firstName: string;
  lastName: string;
  email: string;
  state: string;
};

export type MarketingLeadCaptureContext = {
  referrer?: string | null;
  /** Prefer pathname + search so UTM params are retained. */
  landingPage?: string;
  capturedAt?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmContent?: string;
};

/**
 * Build the POST body the marketing popup / BFF / Lambda all share.
 * Returns field errors for the form UI when invalid.
 */
export function buildMarketingLeadRequestBody(
  values: MarketingLeadFormValues,
  ctx: MarketingLeadCaptureContext = {},
):
  | { ok: true; body: MarketingLeadBody }
  | { ok: false; fieldErrors: Partial<Record<keyof MarketingLeadFormValues, string>> } {
  const parsed = marketingLeadBodySchema.safeParse({
    firstName: values.firstName,
    lastName: values.lastName,
    email: values.email,
    state: values.state,
    referrer: ctx.referrer === undefined ? undefined : ctx.referrer || null,
    landingPage: ctx.landingPage,
    capturedAt: ctx.capturedAt,
    utmSource: ctx.utmSource,
    utmMedium: ctx.utmMedium,
    utmCampaign: ctx.utmCampaign,
    utmContent: ctx.utmContent,
  });
  if (parsed.success) return { ok: true, body: parsed.data };

  const fieldErrors: Partial<Record<keyof MarketingLeadFormValues, string>> = {};
  for (const issue of parsed.error.issues) {
    const key = issue.path[0];
    if (key === "firstName" || key === "lastName" || key === "email" || key === "state") {
      if (!fieldErrors[key]) fieldErrors[key] = issue.message;
    }
  }
  if (Object.keys(fieldErrors).length === 0) {
    fieldErrors.email = parsed.error.issues[0]?.message ?? "Invalid request";
  }
  return { ok: false, fieldErrors };
}

/** Derive attribution bucket stored on the Dynamo lead profile. */
export function resolveMarketingLeadSource(referrer: string | null | undefined): string {
  if (!referrer) return "direct";
  const r = referrer.toLowerCase();
  if (r.includes("google")) return "google";
  if (r.includes("linkedin")) return "linkedin";
  if (r.includes("twitter") || r.includes("x.com")) return "twitter";
  return "referral";
}

const marketingUnsubscribeTokenSchema = z
  .object({
    token: z
      .string()
      .trim()
      .regex(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
        "Invalid token",
      ),
  })
  .strict();

/** Email path for bare /unsubscribe links (e.g. Instantly opt-out → nexcortiq.us/unsubscribe). */
const marketingUnsubscribeEmailSchema = z
  .object({
    email: z
      .string()
      .trim()
      .min(1, "Required")
      .email("Invalid email address")
      .max(320)
      .transform((v) => v.toLowerCase()),
  })
  .strict();

export const marketingUnsubscribeBodySchema = z.union([
  marketingUnsubscribeTokenSchema,
  marketingUnsubscribeEmailSchema,
]);

export type MarketingUnsubscribeBody = z.infer<typeof marketingUnsubscribeBodySchema>;

// ---------------------------------------------------------------------------
// Quote Request — Pricing page estimator form
// ---------------------------------------------------------------------------

export const QUOTE_REQUEST_AGENCY_TYPES = [
  "city_psap",
  "county_psap",
  "municipal_psap",
  "regional_psap",
  "campus",
  "venue",
  "hospital",
  "transit",
  "state_agency",
  "other",
] as const;
export type QuoteRequestAgencyType = (typeof QUOTE_REQUEST_AGENCY_TYPES)[number];
export const QUOTE_REQUEST_AGENCY_TYPE_LABELS: Record<QuoteRequestAgencyType, string> = {
  city_psap: "City / municipal PSAP",
  county_psap: "County / sheriff PSAP",
  municipal_psap: "Multi-agency consolidated center",
  regional_psap: "Regional / statewide center",
  campus: "Campus / university safety",
  venue: "Venue / event operations",
  hospital: "Hospital / healthcare",
  transit: "Transit authority",
  state_agency: "State emergency management",
  other: "Other",
};

export const QUOTE_REQUEST_POPULATION_RANGES = [
  "under_25k",
  "25k_100k",
  "100k_250k",
  "250k_500k",
  "500k_1m",
  "over_1m",
] as const;
export type QuoteRequestPopulationRange = (typeof QUOTE_REQUEST_POPULATION_RANGES)[number];
export const QUOTE_REQUEST_POPULATION_LABELS: Record<QuoteRequestPopulationRange, string> = {
  under_25k: "Under 25,000",
  "25k_100k": "25,000 – 100,000",
  "100k_250k": "100,000 – 250,000",
  "250k_500k": "250,000 – 500,000",
  "500k_1m": "500,000 – 1 million",
  over_1m: "Over 1 million",
};

export const QUOTE_REQUEST_POSITION_RANGES = [
  "1_5",
  "6_15",
  "16_30",
  "31_75",
  "76_150",
  "over_150",
] as const;
export type QuoteRequestPositionRange = (typeof QUOTE_REQUEST_POSITION_RANGES)[number];
export const QUOTE_REQUEST_POSITION_LABELS: Record<QuoteRequestPositionRange, string> = {
  "1_5": "1 – 5",
  "6_15": "6 – 15",
  "16_30": "16 – 30",
  "31_75": "31 – 75",
  "76_150": "76 – 150",
  over_150: "150+",
};

export const QUOTE_REQUEST_PRODUCTS = [
  "call_assist_ai",
  "cad_integration",
  "iq_vision",
  "nexiq_intelligence",
  "pre_arrival_iq",
  "ai_311",
  "qa_coaching",
  "incident_command",
] as const;
export type QuoteRequestProduct = (typeof QUOTE_REQUEST_PRODUCTS)[number];
export const QUOTE_REQUEST_PRODUCT_LABELS: Record<QuoteRequestProduct, string> = {
  call_assist_ai: "Call Assist AI — voice + transcription",
  cad_integration: "CAD Integration (read / write)",
  iq_vision: "IQ Vision — scene intelligence",
  nexiq_intelligence: "Nexiq Intelligence Dashboard",
  pre_arrival_iq: "Pre-Arrival iQ",
  ai_311: "311 AI call handling",
  qa_coaching: "Supervisor QA & coaching tools",
  incident_command: "Incident Command Center",
};

export const QUOTE_REQUEST_TIMELINES = [
  "immediate",
  "1_3_months",
  "3_6_months",
  "6_12_months",
  "evaluating",
] as const;
export type QuoteRequestTimeline = (typeof QUOTE_REQUEST_TIMELINES)[number];
export const QUOTE_REQUEST_TIMELINE_LABELS: Record<QuoteRequestTimeline, string> = {
  immediate: "Immediately — ready to move",
  "1_3_months": "1 – 3 months",
  "3_6_months": "3 – 6 months",
  "6_12_months": "6 – 12 months",
  evaluating: "Just evaluating options",
};

export const quoteRequestBodySchema = z
  .object({
    agencyType: z.enum(QUOTE_REQUEST_AGENCY_TYPES),
    population: z.enum(QUOTE_REQUEST_POPULATION_RANGES),
    positions: z.enum(QUOTE_REQUEST_POSITION_RANGES),
    cadSystem: z.string().trim().max(100).optional(),
    products: z.array(z.string().trim().max(60)).max(20).default([]),
    timeline: z.enum(QUOTE_REQUEST_TIMELINES),
    funding: z.string().trim().max(200).optional(),
    name: z.string().trim().min(1, "Required").max(200),
    agencyName: z.string().trim().min(1, "Required").max(200),
    email: z
      .string()
      .trim()
      .min(1, "Required")
      .email("Invalid email address")
      .max(320)
      .transform((v) => v.toLowerCase()),
    phone: z.string().trim().max(30).optional(),
    notes: z.string().trim().max(2000).optional(),
  })
  .strict();

export type QuoteRequestBody = z.infer<typeof quoteRequestBodySchema>;
