import { z } from "zod";

export const CALL_ASSIST_QA_CHECKLIST = [
  { id: "disclosure", label: "AI disclosure delivered", weight: 1 },
  { id: "emergency_gate", label: "Emergency gate correct (no missed 911, no false 911)", weight: 1.4 },
  { id: "intake_complete", label: "Required intake fields collected", weight: 1 },
  { id: "location", label: "Location confirmed", weight: 1 },
  { id: "language", label: "Language handled", weight: 0.6 },
  { id: "containment", label: "Appropriate containment vs transfer", weight: 1 },
  { id: "self_service", label: "Online reporting / SMS offered when eligible", weight: 0.6 },
  { id: "handoff", label: "Human handoff summary complete", weight: 0.8 },
] as const;

export type CallAssistQaChecklistId = (typeof CALL_ASSIST_QA_CHECKLIST)[number]["id"];

export const callAssistQaItemSchema = z.object({
  id: z.string().min(1).max(64),
  score: z.number().min(0).max(5),
  passed: z.boolean(),
  rationale: z.string().max(500),
  evidenceQuote: z.string().max(400).optional(),
});

export const callAssistQaReviewSchema = z.object({
  reviewId: z.string().min(1).max(128),
  agencyId: z.string().min(1).max(128),
  sessionId: z.string().min(1).max(128),
  source: z.enum(["ai", "human", "comparison"]),
  aggregateScore: z.number().min(0).max(100),
  checklist: z.array(callAssistQaItemSchema).max(40),
  keywordHits: z.array(z.string().max(80)).max(50).optional(),
  falseTransfer: z.boolean().optional(),
  humanTakeover: z.boolean().optional(),
  aiScore: z.number().min(0).max(100).optional(),
  humanScore: z.number().min(0).max(100).optional(),
  scoreDelta: z.number().optional(),
  notes: z.string().max(2000).optional(),
  reviewerId: z.string().max(128).optional(),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
});
export type CallAssistQaReview = z.infer<typeof callAssistQaReviewSchema>;

export const callAssistQaSearchQuerySchema = z.object({
  q: z.string().min(1).max(120),
  from: z.string().max(40).optional(),
  to: z.string().max(40).optional(),
  falseTransfer: z.enum(["true", "false"]).optional(),
  humanTakeover: z.enum(["true", "false"]).optional(),
  language: z.string().max(16).optional(),
});

export const callAssistQaReviewBodySchema = z.object({
  sessionId: z.string().min(1).max(128),
  checklist: z.array(callAssistQaItemSchema).min(1).max(40).optional(),
  notes: z.string().max(2000).optional(),
  falseTransfer: z.boolean().optional(),
  aggregateScore: z.number().min(0).max(100).optional(),
});

export type CallAssistQaUtterance = { speaker: string; text: string; at?: string };

export function searchCallAssistTranscript(
  utterances: CallAssistQaUtterance[],
  query: string,
): Array<{ sequence: number; speaker: string; text: string; at?: string }> {
  const needle = query.trim().toLowerCase();
  if (!needle) return [];
  return utterances
    .map((u, sequence) => ({ sequence, ...u }))
    .filter((u) => u.text.toLowerCase().includes(needle));
}

export function detectFalseTransfer(opts: {
  state: string;
  emergencyDetected?: boolean;
  classification?: string;
  utterances: CallAssistQaUtterance[];
}): boolean {
  const text = opts.utterances.map((u) => u.text).join(" ").toLowerCase();
  const transferred911 = opts.state === "TRANSFERRING_911" || /\b911\b/.test(text);
  if (!transferred911) return false;
  if (opts.emergencyDetected) return false;
  const nonEmergency =
    opts.classification === "REPORT_ONLY" ||
    opts.classification === "INFORMATION_REQUEST" ||
    opts.classification === "PARKING" ||
    opts.classification === "NOISE_COMPLAINT";
  const historical = /\b(yesterday|last night|happened earlier|not happening now)\b/i.test(text);
  return Boolean(nonEmergency || historical);
}

export function scoreCallAssistTranscriptMock(utterances: CallAssistQaUtterance[]): {
  checklist: Array<z.infer<typeof callAssistQaItemSchema>>;
  aggregateScore: number;
} {
  const blob = utterances.map((u) => u.text).join(" ").toLowerCase();
  const caller = utterances.filter((u) => u.speaker === "caller").map((u) => u.text).join(" ");
  const assistant = utterances.filter((u) => u.speaker === "assistant").map((u) => u.text).join(" ");
  const checklist = CALL_ASSIST_QA_CHECKLIST.map((item) => {
    let passed = caller.length > 8;
    let score = passed ? 4 : 2;
    let rationale = "Heuristic score from transcript length and keywords.";
    if (item.id === "disclosure") {
      passed = /recorded|automated assistant|artificial intelligence|ai assistant/i.test(assistant);
      score = passed ? 5 : 2;
      rationale = passed ? "Disclosure language present." : "No disclosure phrasing found.";
    }
    if (item.id === "emergency_gate") {
      const emergency = /\b(gun|weapon|not breathing|heart attack|emergency)\b/i.test(blob);
      const transferred = /dial 911|transferring you|emergency/i.test(assistant);
      passed = !emergency || transferred;
      score = passed ? 5 : 1;
      rationale = passed ? "Emergency handling consistent." : "Possible missed emergency language.";
    }
    if (item.id === "location") {
      passed = /\b(\d{2,5}\s+\w+|building|section|room)\b/i.test(blob);
      score = passed ? 4 : 2;
      rationale = passed ? "Location-like language present." : "Location not evident.";
    }
    if (item.id === "self_service") {
      passed = /online report|text you a secure link|carfax/i.test(assistant) || !/stolen|parking|noise/i.test(caller);
      score = passed ? 4 : 3;
      rationale = "Self-service offer evaluated from assistant lines.";
    }
    return {
      id: item.id,
      score,
      passed,
      rationale,
      evidenceQuote: (utterances.find((u) => u.text.length > 12)?.text ?? "").slice(0, 180),
    };
  });
  const weightSum = CALL_ASSIST_QA_CHECKLIST.reduce((s, c) => s + c.weight, 0);
  const weighted = checklist.reduce((sum, row, i) => sum + (row.score / 5) * CALL_ASSIST_QA_CHECKLIST[i].weight, 0);
  return { checklist, aggregateScore: Math.round((weighted / weightSum) * 100) };
}

export function compareAiVsHuman(aiScore: number, humanScore: number): {
  scoreDelta: number;
  aligned: boolean;
} {
  const scoreDelta = humanScore - aiScore;
  return { scoreDelta, aligned: Math.abs(scoreDelta) <= 12 };
}

export type CallAssistQaDashboard = {
  reviewCount: number;
  aiReviewCount: number;
  humanReviewCount: number;
  averageAiScore: number | null;
  averageHumanScore: number | null;
  falseTransferCount: number;
  falseTransferRate: number | null;
  humanTakeoverCount: number;
  keywordTop: Array<{ term: string; count: number }>;
};

export function summarizeCallAssistQa(reviews: CallAssistQaReview[]): CallAssistQaDashboard {
  const ai = reviews.filter((r) => r.source === "ai");
  const human = reviews.filter((r) => r.source === "human");
  const falseTransferCount = reviews.filter((r) => r.falseTransfer).length;
  const humanTakeoverCount = reviews.filter((r) => r.humanTakeover).length;
  const terms = new Map<string, number>();
  for (const r of reviews) {
    for (const hit of r.keywordHits ?? []) {
      terms.set(hit, (terms.get(hit) ?? 0) + 1);
    }
  }
  const avg = (rows: CallAssistQaReview[]) =>
    rows.length ? rows.reduce((s, r) => s + r.aggregateScore, 0) / rows.length : null;
  return {
    reviewCount: reviews.length,
    aiReviewCount: ai.length,
    humanReviewCount: human.length,
    averageAiScore: avg(ai),
    averageHumanScore: avg(human),
    falseTransferCount,
    falseTransferRate: reviews.length ? falseTransferCount / reviews.length : null,
    humanTakeoverCount,
    keywordTop: [...terms.entries()]
      .map(([term, count]) => ({ term, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 20),
  };
}
