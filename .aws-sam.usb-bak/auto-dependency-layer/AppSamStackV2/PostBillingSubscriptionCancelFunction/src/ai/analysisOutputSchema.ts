import { z } from "zod";
import { incidentCategorySchema, urgencyLevelSchema } from "rapid-cortex-shared";
import { logAiValidationFailure } from "../lib/aiLog.js";

/**
 * Strict post-provider validation before persisting an analysis.
 * Category/urgency enums are shared with `rapid-cortex-shared` so API and persisted `AIAnalysis` stay aligned.
 * Coerces common model sloppiness (numeric strings, boolean strings).
 */
export const aiAnalysisOutputSchema = z.object({
  category: incidentCategorySchema,
  urgency: urgencyLevelSchema,
  confidence: z.coerce.number().min(0).max(1),
  nextQuestion: z.string().trim().min(1).max(500),
  recommendedAction: z.string().trim().min(1).max(1200),
  summary: z.string().trim().min(1).max(800),
  rationale: z.string().trim().min(1).max(1200),
  escalationFlag: z.coerce.boolean(),
});

export type ValidatedAnalysisOutput = z.infer<typeof aiAnalysisOutputSchema>;

export class AnalysisOutputValidationError extends Error {
  constructor(
    message: string,
    public readonly issues: z.ZodIssue[],
  ) {
    super(message);
    this.name = "AnalysisOutputValidationError";
  }
}

function stripJsonFences(text: string): string {
  const t = text.trim();
  const fence = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(t);
  return fence?.[1]?.trim() ?? t;
}

function tryRepairJsonObjectString(text: string): string | null {
  const t = stripJsonFences(text);
  const start = t.indexOf("{");
  const end = t.lastIndexOf("}");
  if (start === -1 || end <= start) return null;
  return t.slice(start, end + 1).trim();
}

/** Accepts a model object or a JSON string (including fenced JSON). One bounded repair pass for sloppy JSON. */
export function parseAndValidateAnalysisOutput(raw: unknown): ValidatedAnalysisOutput {
  let value: unknown = raw;
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    try {
      value = JSON.parse(stripJsonFences(trimmed));
    } catch {
      const repaired = tryRepairJsonObjectString(trimmed);
      if (repaired) {
        try {
          value = JSON.parse(repaired);
        } catch {
          throw new AnalysisOutputValidationError("Model output was not valid JSON", []);
        }
      } else {
        throw new AnalysisOutputValidationError("Model output was not valid JSON", []);
      }
    }
  }
  const parsed = aiAnalysisOutputSchema.safeParse(value);
  if (!parsed.success) {
    logAiValidationFailure(parsed.error.message, parsed.error.issues);
    throw new AnalysisOutputValidationError(
      `Analysis output failed schema validation: ${parsed.error.message}`,
      parsed.error.issues,
    );
  }
  return parsed.data;
}
