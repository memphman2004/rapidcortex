import {
  CALL_ASSIST_QA_CHECKLIST,
  compareAiVsHuman,
  detectFalseTransfer,
  scoreCallAssistTranscriptMock,
  searchCallAssistTranscript,
  summarizeCallAssistQa,
  type CallAssistQaReview,
} from "rapid-cortex-shared";
import { AUDIT_EVENT_TYPES } from "rapid-cortex-security";
import { env } from "../lib/env.js";
import { makeId } from "../lib/ids.js";
import { scoreQaWithBedrock } from "../services/qaScoring.js";
import { AuditRepository } from "../repositories/auditRepository.js";
import { callAssistStore, type CallAssistSessionRecord } from "./store.js";

const auditRepo = new AuditRepository();

function toReview(opts: {
  session: CallAssistSessionRecord;
  source: CallAssistQaReview["source"];
  actorId: string;
  scored: ReturnType<typeof scoreCallAssistTranscriptMock>;
  notes?: string;
  falseTransfer?: boolean;
}): CallAssistQaReview {
  const now = new Date().toISOString();
  const falseTransfer =
    opts.falseTransfer ??
    detectFalseTransfer({
      state: opts.session.state,
      emergencyDetected: opts.session.triage?.emergencyDetected,
      classification: opts.session.triage?.primaryClassification,
      utterances: opts.session.utterances,
    });
  return {
    reviewId: makeId("caqa"),
    agencyId: opts.session.agencyId,
    sessionId: opts.session.sessionId,
    source: opts.source,
    aggregateScore: opts.scored.aggregateScore,
    checklist: opts.scored.checklist,
    falseTransfer,
    humanTakeover: Boolean(opts.session.humanTakeover || opts.session.state === "TRANSFERRING_HUMAN"),
    notes: opts.notes,
    reviewerId: opts.actorId,
    createdAt: now,
    updatedAt: now,
  };
}

export async function scoreCallAssistSession(opts: {
  session: CallAssistSessionRecord;
  actorId: string;
}): Promise<CallAssistQaReview> {
  let scored = scoreCallAssistTranscriptMock(opts.session.utterances);
  if (env.qaBedrockModelId && !env.callAssistConnectMock) {
    try {
      const bedrock = await scoreQaWithBedrock(
        opts.session.utterances.map((u) => `${u.speaker}: ${u.text}`).join("\n"),
        {
          templateId: "call-assist-qa",
          agencyId: opts.session.agencyId,
          name: "Call Assist QA",
          version: 1,
          checklistItems: CALL_ASSIST_QA_CHECKLIST.map((c) => ({ id: c.id, label: c.label, weight: c.weight })),
          createdAt: opts.session.createdAt,
          updatedAt: opts.session.updatedAt,
        },
      );
      scored = {
        checklist: bedrock.checklist.map((row) => ({
          id: row.id,
          score: row.score,
          passed: row.passed,
          rationale: row.rationale,
          evidenceQuote: row.evidenceQuote,
        })),
        aggregateScore: bedrock.aggregateScore,
      };
    } catch {
      scored = scoreCallAssistTranscriptMock(opts.session.utterances);
    }
  }
  const existing = await callAssistStore.getQaReview(opts.session.agencyId, opts.session.sessionId);
  const review = toReview({ session: opts.session, source: "ai", actorId: opts.actorId, scored });
  if (existing?.source === "human") {
    review.source = "comparison";
    review.humanScore = existing.aggregateScore;
    review.aiScore = scored.aggregateScore;
    const cmp = compareAiVsHuman(scored.aggregateScore, existing.aggregateScore);
    review.scoreDelta = cmp.scoreDelta;
    review.notes = existing.notes;
    review.falseTransfer = existing.falseTransfer ?? review.falseTransfer;
  }
  opts.session.falseTransferSuspected = review.falseTransfer;
  opts.session.updatedAt = review.updatedAt;
  await callAssistStore.putQaReview(review);
  await callAssistStore.putSession(opts.session);
  await auditRepo.create({
    eventId: makeId("audit"),
    agencyId: opts.session.agencyId,
    actorId: opts.actorId,
    type: AUDIT_EVENT_TYPES.CALL_ASSIST_QA_SCORED,
    details: { sessionId: opts.session.sessionId, source: review.source, score: review.aggregateScore },
    createdAt: review.createdAt,
    resourceType: "session",
    resourceId: opts.session.sessionId,
  });
  return review;
}

export async function saveHumanQaReview(opts: {
  session: CallAssistSessionRecord;
  actorId: string;
  aggregateScore?: number;
  notes?: string;
  falseTransfer?: boolean;
}): Promise<CallAssistQaReview> {
  const ai = await callAssistStore.getQaReview(opts.session.agencyId, opts.session.sessionId);
  const scored = scoreCallAssistTranscriptMock(opts.session.utterances);
  if (opts.aggregateScore != null) scored.aggregateScore = opts.aggregateScore;
  const review = toReview({
    session: opts.session,
    source: "human",
    actorId: opts.actorId,
    scored,
    notes: opts.notes,
    falseTransfer: opts.falseTransfer,
  });
  if (ai?.source === "ai" || ai?.aiScore != null) {
    review.source = "comparison";
    review.aiScore = ai.aiScore ?? ai.aggregateScore;
    review.humanScore = review.aggregateScore;
    review.scoreDelta = compareAiVsHuman(review.aiScore ?? 0, review.aggregateScore).scoreDelta;
  }
  opts.session.falseTransferSuspected = review.falseTransfer;
  await callAssistStore.putQaReview(review);
  await callAssistStore.putSession(opts.session);
  await auditRepo.create({
    eventId: makeId("audit"),
    agencyId: opts.session.agencyId,
    actorId: opts.actorId,
    type: AUDIT_EVENT_TYPES.CALL_ASSIST_QA_SCORED,
    details: { sessionId: opts.session.sessionId, source: review.source, score: review.aggregateScore },
    createdAt: review.updatedAt,
    resourceType: "session",
    resourceId: opts.session.sessionId,
  });
  return review;
}

export async function searchCallAssistQa(opts: {
  agencyId: string;
  q: string;
  falseTransfer?: boolean;
  humanTakeover?: boolean;
  language?: string;
}) {
  const [open, done] = await Promise.all([
    callAssistStore.listSessions(opts.agencyId, true, 200),
    callAssistStore.listSessions(opts.agencyId, false, 200),
  ]);
  const sessions = [...open, ...done].filter((s) => s.agencyId === opts.agencyId);
  const hits = [];
  for (const session of sessions) {
    if (opts.language && session.language !== opts.language) continue;
    if (opts.humanTakeover && !session.humanTakeover) continue;
    if (opts.falseTransfer && !session.falseTransferSuspected) continue;
    const matches = searchCallAssistTranscript(session.utterances, opts.q);
    if (!matches.length) continue;
    hits.push({
      sessionId: session.sessionId,
      state: session.state,
      language: session.language,
      createdAt: session.createdAt,
      matches,
    });
  }
  return hits.slice(0, 50);
}

export async function callAssistQaDashboard(agencyId: string) {
  const reviews = await callAssistStore.listQaReviews(agencyId, 300);
  return summarizeCallAssistQa(reviews.filter((r) => r.agencyId === agencyId));
}

export { CALL_ASSIST_QA_CHECKLIST };
