import { EMERGENCY_TRANSFER_ACTION } from "./classifications.js";
import type { SafetyDecision, SafetyTriggerId } from "./safety.js";
import { isImmutableEmergency } from "./safety.js";

/**
 * Voice emotion / distress detection.
 *
 * Live path is Amazon Comprehend DetectSentiment + lexical distress + optional
 * Amazon Connect Contact Lens voice tone. This is not a custom acoustic CNN.
 * Distress may escalate to 911; it never suppresses an existing safety transfer.
 */

export const VOICE_EMOTION_LABELS = ["CALM", "ANXIOUS", "ANGRY", "DISTRESSED", "PANIC", "UNKNOWN"] as const;
export type VoiceEmotionLabel = (typeof VOICE_EMOTION_LABELS)[number];

export const VOICE_DISTRESS_LEVELS = ["NONE", "MODERATE", "HIGH", "CRITICAL"] as const;
export type VoiceDistressLevel = (typeof VOICE_DISTRESS_LEVELS)[number];

export const VOICE_EMOTION_SOURCES = ["mock", "comprehend", "contact_lens", "lexicon"] as const;
export type VoiceEmotionSource = (typeof VOICE_EMOTION_SOURCES)[number];

export type VoiceEmotionAssessment = {
  label: VoiceEmotionLabel;
  distressLevel: VoiceDistressLevel;
  score: number;
  escalateToEmergency: boolean;
  source: VoiceEmotionSource;
  reasons: string[];
  at: string;
};

const PANIC_RE =
  /\b(i'?m (gonna|going to) die|he'?s going to kill me|she'?s going to kill me|they'?re going to kill me|please help me|i can'?t breathe|screaming|crying|sobbing)\b/i;
const DISTRESS_RE =
  /\b(help me|i'?m scared|i'?m terrified|please hurry|oh my god|oh god|i'?m shaking|panicking|i don'?t know what to do)\b/i;
const ANGRY_RE = /\b(this is ridiculous|you people|i'?m furious|damn it|hell with (this|you))\b/i;
const ANXIOUS_RE = /\b(i'?m worried|i'?m nervous|not sure what to do|can you just)\b/i;

export function scoreDistressFromTranscript(text: string): {
  label: VoiceEmotionLabel;
  distressLevel: VoiceDistressLevel;
  score: number;
  reasons: string[];
} {
  const t = (text ?? "").trim();
  if (!t) {
    return { label: "UNKNOWN", distressLevel: "NONE", score: 0, reasons: ["empty"] };
  }
  if (PANIC_RE.test(t)) {
    return { label: "PANIC", distressLevel: "CRITICAL", score: 0.95, reasons: ["panic_lexicon"] };
  }
  if (DISTRESS_RE.test(t)) {
    return { label: "DISTRESSED", distressLevel: "HIGH", score: 0.82, reasons: ["distress_lexicon"] };
  }
  if (ANGRY_RE.test(t)) {
    return { label: "ANGRY", distressLevel: "MODERATE", score: 0.55, reasons: ["anger_lexicon"] };
  }
  if (ANXIOUS_RE.test(t)) {
    return { label: "ANXIOUS", distressLevel: "MODERATE", score: 0.45, reasons: ["anxiety_lexicon"] };
  }
  return { label: "CALM", distressLevel: "NONE", score: 0.1, reasons: ["no_distress_lexicon"] };
}

export function mapSentimentToDistress(opts: {
  label: "POSITIVE" | "NEGATIVE" | "NEUTRAL" | "MIXED";
  negative: number;
}): { distressLevel: VoiceDistressLevel; emotion: VoiceEmotionLabel; score: number } {
  if (opts.label === "NEGATIVE" && opts.negative >= 0.85) {
    return { distressLevel: "HIGH", emotion: "DISTRESSED", score: opts.negative };
  }
  if (opts.label === "NEGATIVE" && opts.negative >= 0.65) {
    return { distressLevel: "MODERATE", emotion: "ANXIOUS", score: opts.negative };
  }
  if (opts.label === "POSITIVE") {
    return { distressLevel: "NONE", emotion: "CALM", score: 1 - opts.negative };
  }
  return { distressLevel: "NONE", emotion: "UNKNOWN", score: opts.negative };
}

export function mapContactLensTone(tone: string | undefined): VoiceEmotionLabel | null {
  const t = (tone ?? "").trim().toUpperCase();
  if (!t) return null;
  if (t === "NEGATIVE" || t === "AGITATED") return "DISTRESSED";
  if (t === "POSITIVE") return "CALM";
  if (t === "NEUTRAL") return "CALM";
  return null;
}

export function combineVoiceEmotion(opts: {
  transcript: string;
  sentiment?: { label: "POSITIVE" | "NEGATIVE" | "NEUTRAL" | "MIXED"; negative: number };
  contactLensTone?: string;
  source: VoiceEmotionSource;
  at?: string;
}): VoiceEmotionAssessment {
  const lexical = scoreDistressFromTranscript(opts.transcript);
  const tone = mapContactLensTone(opts.contactLensTone);
  const sent = opts.sentiment ? mapSentimentToDistress(opts.sentiment) : null;
  let label = lexical.label;
  let distressLevel = lexical.distressLevel;
  let score = lexical.score;
  const reasons = [...lexical.reasons];
  if (sent && rankDistress(sent.distressLevel) > rankDistress(distressLevel)) {
    distressLevel = sent.distressLevel;
    label = sent.emotion;
    score = Math.max(score, sent.score);
    reasons.push("sentiment_model");
  }
  if (tone === "DISTRESSED" && rankDistress(distressLevel) < rankDistress("HIGH")) {
    label = "DISTRESSED";
    distressLevel = "HIGH";
    score = Math.max(score, 0.8);
    reasons.push("contact_lens_tone");
  }
  const escalateToEmergency = distressLevel === "CRITICAL" || (distressLevel === "HIGH" && score >= 0.8);
  return {
    label,
    distressLevel,
    score: Math.min(1, score),
    escalateToEmergency,
    source: opts.source,
    reasons,
    at: opts.at ?? new Date().toISOString(),
  };
}

function rankDistress(level: VoiceDistressLevel): number {
  if (level === "CRITICAL") return 3;
  if (level === "HIGH") return 2;
  if (level === "MODERATE") return 1;
  return 0;
}

export function mergeVoiceDistressIntoSafety(
  safety: SafetyDecision,
  emotion: VoiceEmotionAssessment | null | undefined,
): SafetyDecision {
  if (!emotion) return safety;
  if (isImmutableEmergency(safety)) {
    return emotion.escalateToEmergency
      ? {
          ...safety,
          triggers: uniqueTriggers([...safety.triggers, "VOICE_DISTRESS"]),
          reasons: [...safety.reasons, "voice_distress_confirms"],
        }
      : safety;
  }
  if (!emotion.escalateToEmergency) return safety;
  return {
    classification: "EMERGENCY",
    action: EMERGENCY_TRANSFER_ACTION,
    continueAiConversation: false,
    riskLevel: "CRITICAL",
    triggers: uniqueTriggers([...safety.triggers, "VOICE_DISTRESS"]),
    matchedPhrases: safety.matchedPhrases,
    reasons: [...safety.reasons, "voice_distress_model"],
  };
}

function uniqueTriggers(ids: SafetyTriggerId[]): SafetyTriggerId[] {
  return [...new Set(ids)];
}
