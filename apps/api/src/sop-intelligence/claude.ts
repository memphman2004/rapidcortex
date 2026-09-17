import {
  sopClaudeSuggestionSchema,
  type SopClaudeSuggestion,
  type SopLibraryStep,
} from "rapid-cortex-shared";
import { resolvePlainOrSecretArn } from "../lib/runtimeSecrets.js";
import { env } from "../lib/env.js";

async function resolveAnthropicKey(): Promise<string> {
  return resolvePlainOrSecretArn(
    process.env.ANTHROPIC_API_KEY,
    process.env.ANTHROPIC_API_KEY_SECRET_ARN,
    { preferredField: "apiKey" },
  );
}

function parseSuggestion(text: string, fallback: SopClaudeSuggestion): SopClaudeSuggestion {
  const cleaned = text.replace(/```json|```/g, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start < 0 || end <= start) return fallback;
  try {
    const parsed = sopClaudeSuggestionSchema.safeParse(JSON.parse(cleaned.slice(start, end + 1)));
    return parsed.success ? parsed.data : fallback;
  } catch {
    return fallback;
  }
}

export function mockSopSuggestion(params: {
  currentLanguage: string;
  gapDescription?: string;
  evidenceCount: number;
}): SopClaudeSuggestion {
  const addition =
    params.gapDescription?.trim() ||
    "If the caller’s stated location conflicts with ALI, stay with the stated location and flag a discrepancy for GIS.";
  return {
    suggestedLanguage: `${params.currentLanguage.trim()} ${addition}`.trim(),
    rationale:
      `${params.evidenceCount} SOP-gap reports on this step. Suggested language makes the ALI-vs-stated-location rule explicit.`,
    confidence: 0.72,
    rootCauseType: "procedure_gap",
    evidence: ["pattern_threshold", "sop_gap_reports"],
  };
}

export async function generateSopLanguageSuggestion(params: {
  sopTitle: string;
  step: SopLibraryStep;
  gapDescription?: string;
  evidenceCount: number;
  reportNotes: string[];
}): Promise<SopClaudeSuggestion> {
  const fallback = mockSopSuggestion({
    currentLanguage: params.step.text,
    gapDescription: params.gapDescription,
    evidenceCount: params.evidenceCount,
  });
  if (env.sopIntelligenceClaudeMock) return fallback;

  const apiKey = await resolveAnthropicKey();
  if (!apiKey) return fallback;

  const model = process.env.ANTHROPIC_MODEL_PRIMARY?.trim() || "claude-sonnet-4-20250514";
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: 1200,
      system:
        "You are a 9-1-1 SOP editor. Return only JSON with keys suggestedLanguage, rationale, confidence (0-1), rootCauseType, evidence (string array). Do not invent CAD or legal requirements. Keep suggestedLanguage operational and dispatcher-facing.",
      messages: [
        {
          role: "user",
          content: JSON.stringify({
            sopTitle: params.sopTitle,
            stepNumber: params.step.stepNumber,
            currentLanguage: params.step.text,
            gapDescription: params.gapDescription ?? "",
            evidenceCount: params.evidenceCount,
            reportNotes: params.reportNotes.slice(0, 8),
          }),
        },
      ],
    }),
    signal: AbortSignal.timeout(45_000),
  });
  if (!res.ok) return fallback;
  const body = (await res.json()) as { content?: Array<{ type: string; text?: string }> };
  const text = body.content?.find((b) => b.type === "text")?.text ?? "";
  return parseSuggestion(text, fallback);
}
