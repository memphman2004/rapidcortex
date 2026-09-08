import { z } from "zod";

export const CALL_ASSIST_SENTIMENT_LABELS = ["POSITIVE", "NEGATIVE", "NEUTRAL", "MIXED"] as const;
export type CallAssistSentimentLabel = (typeof CALL_ASSIST_SENTIMENT_LABELS)[number];

export const CALL_ASSIST_SENTIMENT_SOURCES = ["lex", "comprehend", "mock", "combined"] as const;
export type CallAssistSentimentSource = (typeof CALL_ASSIST_SENTIMENT_SOURCES)[number];

export const callAssistSentimentSchema = z.object({
  label: z.enum(CALL_ASSIST_SENTIMENT_LABELS),
  scores: z.object({
    positive: z.number().min(0).max(1),
    negative: z.number().min(0).max(1),
    neutral: z.number().min(0).max(1),
    mixed: z.number().min(0).max(1),
  }),
  source: z.enum(CALL_ASSIST_SENTIMENT_SOURCES),
  at: z.string().min(1),
});
export type CallAssistSentiment = z.infer<typeof callAssistSentimentSchema>;

export type LexSentimentInput = {
  sentiment: CallAssistSentimentLabel;
  sentimentScore: { positive: number; negative: number; neutral: number; mixed: number };
};

export function sentimentFromLex(input: LexSentimentInput | undefined | null, at?: string): CallAssistSentiment | null {
  if (!input?.sentiment || !input.sentimentScore) return null;
  return {
    label: input.sentiment,
    scores: {
      positive: clamp01(input.sentimentScore.positive),
      negative: clamp01(input.sentimentScore.negative),
      mixed: clamp01(input.sentimentScore.mixed),
      neutral: clamp01(input.sentimentScore.neutral),
    },
    source: "lex",
    at: at ?? new Date().toISOString(),
  };
}

export function mockSentimentFromText(text: string, at?: string): CallAssistSentiment {
  const t = text.toLowerCase();
  const negative = /\b(angry|terrible|hate|worst|scared|kill|help me|crying)\b/.test(t);
  const positive = /\b(thanks|thank you|great|appreciate)\b/.test(t);
  const label: CallAssistSentimentLabel = negative ? "NEGATIVE" : positive ? "POSITIVE" : "NEUTRAL";
  return {
    label,
    scores: {
      positive: label === "POSITIVE" ? 0.82 : 0.08,
      negative: label === "NEGATIVE" ? 0.84 : 0.08,
      mixed: 0.04,
      neutral: label === "NEUTRAL" ? 0.8 : 0.04,
    },
    source: "mock",
    at: at ?? new Date().toISOString(),
  };
}

export function combineSentiment(
  lex: CallAssistSentiment | null,
  other: CallAssistSentiment | null,
): CallAssistSentiment | null {
  if (!lex && !other) return null;
  if (!lex) return other;
  if (!other) return lex;
  const preferNegative = lex.scores.negative >= other.scores.negative ? lex : other;
  if (preferNegative.scores.negative >= 0.6) {
    return { ...preferNegative, source: "combined" };
  }
  return { ...lex, source: "combined", scores: averageScores(lex.scores, other.scores) };
}

function averageScores(
  a: CallAssistSentiment["scores"],
  b: CallAssistSentiment["scores"],
): CallAssistSentiment["scores"] {
  return {
    positive: (a.positive + b.positive) / 2,
    negative: (a.negative + b.negative) / 2,
    mixed: (a.mixed + b.mixed) / 2,
    neutral: (a.neutral + b.neutral) / 2,
  };
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.min(1, Math.max(0, n));
}
