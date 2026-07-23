import { z } from "zod";

/** Personal inbox domains rejected for Inside the Cortex business-email capture. */
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

export const marketingUnsubscribeBodySchema = z
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

export type MarketingUnsubscribeBody = z.infer<typeof marketingUnsubscribeBodySchema>;
