import { z } from "zod";
import { logAiValidationFailure } from "../aiLog.js";

const rawFieldSchema = z.object({
  value: z.string().nullable(),
  sourceQuote: z.string().nullable().optional(),
  score: z.preprocess((raw) => {
    const n = typeof raw === "string" ? Number(raw) : raw;
    return typeof n === "number" && !Number.isNaN(n) ? n : raw;
  }, z.number().min(0).max(100)),
  reason: z.string().trim().min(1).max(300),
  suggestedQuestion: z.string().trim().min(1).max(300).nullable(),
  conflictingValues: z.array(z.string()).default([]),
});

export const confidenceOutputSchema = z.object({
  fields: z.record(z.string(), rawFieldSchema),
  audioQualityFactor: z.preprocess((raw) => {
    const n = typeof raw === "string" ? Number(raw) : raw;
    return typeof n === "number" && !Number.isNaN(n) ? n : 1;
  }, z.number().min(0).max(1)),
});

export type ValidatedConfidenceOutput = z.infer<typeof confidenceOutputSchema>;

export class ConfidenceOutputValidationError extends Error {
  constructor(
    message: string,
    public readonly issues: z.ZodIssue[],
  ) {
    super(message);
    this.name = "ConfidenceOutputValidationError";
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
export function parseAndValidateConfidenceOutput(raw: unknown): ValidatedConfidenceOutput {
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
          throw new ConfidenceOutputValidationError("Model output was not valid JSON", []);
        }
      } else {
        throw new ConfidenceOutputValidationError("Model output was not valid JSON", []);
      }
    }
  }
  const parsed = confidenceOutputSchema.safeParse(value);
  if (!parsed.success) {
    logAiValidationFailure(parsed.error.message, parsed.error.issues);
    throw new ConfidenceOutputValidationError(
      `Confidence output failed schema validation: ${parsed.error.message}`,
      parsed.error.issues,
    );
  }
  return parsed.data;
}
