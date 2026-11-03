import { z } from "zod";

/**
 * Same seats as the Sales Portal pipeline: rcsuperadmin, rcadmin, salescontractor.
 */
export function canAccessSalesTools(role: string | undefined | null): boolean {
  const r = String(role ?? "")
    .trim()
    .toLowerCase();
  return r === "rcsuperadmin" || r === "rcadmin" || r === "salescontractor";
}

/** Sales Call Coach verticals (outbound enablement, not PSAP ops). */
export const SALES_CALL_COACH_VERTICALS = [
  "core_psap",
  "campus",
  "venue",
  "transit",
  "hospital",
  "general",
] as const;
export type SalesCallCoachVertical = (typeof SALES_CALL_COACH_VERTICALS)[number];

export const SALES_CALL_COACH_MIN_TRANSCRIPT = 50;
export const SALES_CALL_COACH_MAX_TRANSCRIPT = 50_000;

export const salesCallCoachAnalyzeRequestSchema = z.object({
  transcript: z
    .string()
    .trim()
    .min(SALES_CALL_COACH_MIN_TRANSCRIPT)
    .max(SALES_CALL_COACH_MAX_TRANSCRIPT),
  vertical: z.enum(SALES_CALL_COACH_VERTICALS).optional().default("general"),
});

export type SalesCallCoachAnalyzeRequest = z.infer<typeof salesCallCoachAnalyzeRequestSchema>;

export const salesCallCoachCategorySchema = z.object({
  id: z.string().trim().min(1).max(64),
  label: z.string().trim().min(1).max(120),
  score: z.number().min(0).max(10),
  strengths: z.array(z.string().trim().min(1).max(500)).max(8),
  improvements: z.array(z.string().trim().min(1).max(500)).max(8),
});

export type SalesCallCoachCategory = z.infer<typeof salesCallCoachCategorySchema>;

export const salesCallCoachResultSchema = z.object({
  overallScore: z.number().min(0).max(10),
  verdict: z.string().trim().min(1).max(400),
  categories: z.array(salesCallCoachCategorySchema).min(1).max(12),
  redFlags: z.array(z.string().trim().min(1).max(500)).max(20),
  nextSteps: z.array(z.string().trim().min(1).max(500)).max(20),
  mock: z.boolean().optional().default(false),
});

export type SalesCallCoachResult = z.infer<typeof salesCallCoachResultSchema>;

/** Demo / BEDROCK_MOCK fixture matching the Sales Tools preview UI. */
export function salesCallCoachMockFixture(
  overrides: Partial<SalesCallCoachResult> = {},
): SalesCallCoachResult {
  return salesCallCoachResultSchema.parse({
    overallScore: 8.1,
    verdict:
      "Strong discovery and rapport. Tighten the close and surface one sharper next step before ending the call.",
    categories: [
      {
        id: "rapport",
        label: "Rapport & Opening",
        score: 8.5,
        strengths: ["Warm greeting", "Clear agenda in the first minute"],
        improvements: ["Confirm timebox earlier"],
      },
      {
        id: "discovery",
        label: "Discovery",
        score: 8.8,
        strengths: ["Probed pain around dispatch workload", "Asked about budget cycle"],
        improvements: ["Quantify impact in dollars or FTE hours"],
      },
      {
        id: "value",
        label: "Value Narrative",
        score: 7.6,
        strengths: ["Tied product to NG911 readiness"],
        improvements: ["Use one concrete agency peer example"],
      },
      {
        id: "objection",
        label: "Objection Handling",
        score: 7.2,
        strengths: ["Acknowledged procurement timeline"],
        improvements: ["Offer a smaller pilot path when RFP friction appears"],
      },
      {
        id: "listening",
        label: "Active Listening",
        score: 8.4,
        strengths: ["Mirrored stakeholder language", "Paused after key answers"],
        improvements: ["Summarize three takeaways mid-call"],
      },
      {
        id: "close",
        label: "Close & Next Steps",
        score: 7.0,
        strengths: ["Proposed a follow-up"],
        improvements: ["Lock a calendar date and attendees before hang-up"],
      },
    ],
    redFlags: [
      "Competitor name mentioned without a clear differentiation response",
      "No explicit budget owner identified",
    ],
    nextSteps: [
      "Send one-pager tailored to their CAD/NG911 stack within 24 hours",
      "Book a 30-minute technical deep-dive with IT + operations",
      "Ask for introduction to the budget owner before month-end",
    ],
    mock: true,
    ...overrides,
  });
}
