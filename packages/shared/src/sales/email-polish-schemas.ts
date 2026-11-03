import { z } from "zod";

export const SALES_EMAIL_POLISH_MIN_BODY = 20;
export const SALES_EMAIL_POLISH_MAX_BODY = 20_000;
export const SALES_EMAIL_POLISH_MAX_SUBJECT = 500;

export const salesEmailPolishRequestSchema = z.object({
  subject: z.string().trim().max(SALES_EMAIL_POLISH_MAX_SUBJECT).optional().default(""),
  body: z
    .string()
    .trim()
    .min(SALES_EMAIL_POLISH_MIN_BODY)
    .max(SALES_EMAIL_POLISH_MAX_BODY),
  tone: z.enum(["professional", "warm", "concise"]).optional().default("professional"),
});

export type SalesEmailPolishRequest = z.infer<typeof salesEmailPolishRequestSchema>;

export const salesEmailPolishResultSchema = z.object({
  subject: z.string().trim().max(SALES_EMAIL_POLISH_MAX_SUBJECT),
  body: z.string().trim().min(1).max(SALES_EMAIL_POLISH_MAX_BODY),
  notes: z.array(z.string().trim().min(1).max(300)).max(12).optional().default([]),
  mock: z.boolean().optional().default(false),
});

export type SalesEmailPolishResult = z.infer<typeof salesEmailPolishResultSchema>;

/** Deterministic fixture when BEDROCK_MOCK=1 or Bedrock unavailable. */
export function salesEmailPolishMockFixture(
  input: SalesEmailPolishRequest,
): SalesEmailPolishResult {
  const subject = (input.subject || "").trim();
  let body = input.body.trim();
  // Light deterministic cleanup so UI can demo without Bedrock.
  body = body
    .replace(/\s+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/\bi\b/g, "I")
    .replace(/\s{2,}/g, " ")
    .trim();
  if (!body.endsWith("\n")) {
    /* keep as-is */
  }
  return salesEmailPolishResultSchema.parse({
    subject: subject || "Following up — NexCort iQ",
    body,
    notes: [
      "Mock polish: normalized whitespace and capitalization.",
      "Deploy with Bedrock for full grammar and tone rewrite.",
    ],
    mock: true,
  });
}
