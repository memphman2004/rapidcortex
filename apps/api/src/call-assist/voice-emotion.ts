import { ComprehendClient, DetectSentimentCommand } from "@aws-sdk/client-comprehend";
import {
  combineVoiceEmotion,
  mockSentimentFromText,
  type CallAssistSentiment,
  type VoiceEmotionAssessment,
} from "rapid-cortex-shared";
import { env } from "../lib/env.js";

let comprehend: ComprehendClient | null = null;

function client(): ComprehendClient {
  if (!comprehend) comprehend = new ComprehendClient({ region: env.region || "us-east-1" });
  return comprehend;
}

async function liveComprehendSentiment(text: string): Promise<CallAssistSentiment | null> {
  try {
    const out = await client().send(
      new DetectSentimentCommand({
        Text: text.slice(0, 5000),
        LanguageCode: "en",
      }),
    );
    const label = (out.Sentiment ?? "NEUTRAL") as CallAssistSentiment["label"];
    const scores = out.SentimentScore;
    return {
      label: ["POSITIVE", "NEGATIVE", "NEUTRAL", "MIXED"].includes(label) ? label : "NEUTRAL",
      scores: {
        positive: scores?.Positive ?? 0,
        negative: scores?.Negative ?? 0,
        mixed: scores?.Mixed ?? 0,
        neutral: scores?.Neutral ?? 0,
      },
      source: "comprehend",
      at: new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

export async function analyzeCallAssistSentiment(opts: {
  text: string;
  lex?: CallAssistSentiment | null;
}): Promise<CallAssistSentiment> {
  if (env.callAssistVoiceEmotionMock) {
    return mockSentimentFromText(opts.text);
  }
  const live = await liveComprehendSentiment(opts.text);
  if (opts.lex && live) {
    return {
      ...live,
      scores: {
        positive: (live.scores.positive + opts.lex.scores.positive) / 2,
        negative: Math.max(live.scores.negative, opts.lex.scores.negative),
        mixed: (live.scores.mixed + opts.lex.scores.mixed) / 2,
        neutral: (live.scores.neutral + opts.lex.scores.neutral) / 2,
      },
      source: "combined",
    };
  }
  return live ?? opts.lex ?? mockSentimentFromText(opts.text);
}

export async function analyzeVoiceEmotion(opts: {
  text: string;
  lexSentiment?: CallAssistSentiment | null;
  contactLensTone?: string;
}): Promise<VoiceEmotionAssessment> {
  const sentiment = opts.lexSentiment ?? (await analyzeCallAssistSentiment({ text: opts.text }));
  return combineVoiceEmotion({
    transcript: opts.text,
    sentiment: { label: sentiment.label, negative: sentiment.scores.negative },
    contactLensTone: opts.contactLensTone,
    source: env.callAssistVoiceEmotionMock ? "mock" : "comprehend",
  });
}
