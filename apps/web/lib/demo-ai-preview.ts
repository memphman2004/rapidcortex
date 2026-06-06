import { buildProtocolGuidance } from "rapid-cortex-shared";
import type { AIAnalysis, IncidentCategory, TranscriptSegment, UrgencyLevel } from "rapid-cortex-shared";
import { DEMO_TRANSCRIPT_CHUNKS } from "@/lib/demo-scenarios";

type Preview = Pick<
  AIAnalysis,
  | "category"
  | "urgency"
  | "confidence"
  | "nextQuestion"
  | "recommendedAction"
  | "summary"
  | "rationale"
  | "escalationFlag"
>;

const previews: Record<string, Preview> = {
  "cardiac-arrest": {
    category: "medical",
    urgency: "critical",
    confidence: 0.94,
    nextQuestion: "Is the patient breathing normally right now?",
    recommendedAction:
      "Treat as possible cardiac arrest; prepare CPR instructions and ALS dispatch.",
    summary: "Chest pain with sudden collapse — high-risk medical.",
    rationale: "Transcript references chest pain and abnormal breathing.",
    escalationFlag: true,
  },
  "house-fire": {
    category: "fire",
    urgency: "critical",
    confidence: 0.9,
    nextQuestion: "Confirm evacuation and exposures on all sides.",
    recommendedAction: "Full structure fire response; establish accountability.",
    summary: "Smoke and flames reported at a residence.",
    rationale: "Caller describes visible fire and smoke.",
    escalationFlag: true,
  },
  "domestic-disturbance": {
    category: "police",
    urgency: "high",
    confidence: 0.86,
    nextQuestion: "Are weapons visible or mentioned beyond the knife reference?",
    recommendedAction: "Law enforcement priority; maintain open line and location.",
    summary: "Disturbance with possible weapon involvement.",
    rationale: "Neighbor reports breaking sounds and knife reference.",
    escalationFlag: true,
  },
  "welfare-check": {
    category: "welfare_check",
    urgency: "moderate",
    confidence: 0.72,
    nextQuestion: "Can you see the subject or signs of forced entry?",
    recommendedAction: "Dispatch welfare check; avoid solo entry by caller.",
    summary: "Unable to reach elderly party; unsecured door.",
    rationale: "Welfare concern with access uncertainty.",
    escalationFlag: false,
  },
  "panic-open-line": {
    category: "unknown",
    urgency: "high",
    confidence: 0.48,
    nextQuestion: "If you can hear me, tap or speak once for immediate help.",
    recommendedAction: "Keep line open; trace if available; prepare voice-only triage.",
    summary: "Open line with unclear content — risk uncertain.",
    rationale: "Fragmented audio and distress without clear facts.",
    escalationFlag: true,
  },
  "aed-retrieval": {
    category: "medical",
    urgency: "critical",
    confidence: 0.92,
    nextQuestion: "Confirm shock delivered and CPR resumed immediately after.",
    recommendedAction: "Cardiac arrest pathway with AED; ALS and BLS coordination.",
    summary: "CPR in progress with AED deployed and shock advised.",
    rationale: "Transcript describes compressions, AED retrieval, and shock cycle.",
    escalationFlag: true,
  },
};

export function buildDemoAiAnalysis(
  scenarioId: string,
): AIAnalysis | null {
  const p = previews[scenarioId];
  if (!p) return null;

  const chunks = DEMO_TRANSCRIPT_CHUNKS[scenarioId] ?? [];
  const segments: TranscriptSegment[] = chunks.map((c, i) => ({
    segmentId: `demo_preview_seg_${scenarioId}_${i}`,
    incidentId: "demo-playback",
    agencyId: "demo-agency",
    speaker: c.speaker,
    text: c.text,
    timestamp: new Date().toISOString(),
  }));
  const protocolGuidance = buildProtocolGuidance(segments, "demo-agency", "en");

  return {
    analysisId: `demo_preview_${scenarioId}`,
    incidentId: "demo-playback",
    agencyId: "demo-agency",
    provider: "demo-preview",
    createdAt: new Date().toISOString(),
    category: p.category as IncidentCategory,
    urgency: p.urgency as UrgencyLevel,
    confidence: p.confidence,
    nextQuestion: p.nextQuestion,
    recommendedAction: p.recommendedAction,
    summary: p.summary,
    rationale: p.rationale,
    escalationFlag: p.escalationFlag,
    ...(protocolGuidance ? { protocolGuidance } : {}),
  };
}
