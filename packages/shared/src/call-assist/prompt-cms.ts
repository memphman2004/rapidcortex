import { z } from "zod";

export const CALL_ASSIST_PROMPT_KEYS = [
  "opening",
  "emergencyTransfer",
  "humanTransfer",
  "fallbackTransfer",
  "incidentCreated",
  "onlineReportEligible",
  "carfaxEligible",
  "callbackOffer",
  "smsOffer",
  "dispatchTriage",
] as const;
export type CallAssistPromptKey = (typeof CALL_ASSIST_PROMPT_KEYS)[number];

export const CALL_ASSIST_PROMPT_LABELS: Record<CallAssistPromptKey, string> = {
  opening: "Opening / disclosure",
  emergencyTransfer: "Emergency transfer",
  humanTransfer: "Human transfer",
  fallbackTransfer: "Low-confidence fallback",
  incidentCreated: "Incident created / closing",
  onlineReportEligible: "Online reporting offer",
  carfaxEligible: "Vehicle reporting offer",
  callbackOffer: "Callback offer",
  smsOffer: "SMS self-service offer",
  dispatchTriage: "Dispatch AI system prompt",
};

export const callAssistPromptVersionSchema = z.object({
  version: z.number().int().min(1),
  body: z.string().min(1).max(20_000),
  updatedAt: z.string().min(1),
  updatedBy: z.string().min(1).max(128),
});
export type CallAssistPromptVersion = z.infer<typeof callAssistPromptVersionSchema>;

export const callAssistPromptRecordSchema = z.object({
  promptId: z.enum(CALL_ASSIST_PROMPT_KEYS),
  agencyId: z.string().min(1).max(128),
  body: z.string().min(1).max(20_000),
  version: z.number().int().min(1),
  updatedAt: z.string().min(1),
  updatedBy: z.string().min(1).max(128),
  previous: z.array(callAssistPromptVersionSchema).max(25).default([]),
});
export type CallAssistPromptRecord = z.infer<typeof callAssistPromptRecordSchema>;

export const callAssistPromptUpsertSchema = z.object({
  promptId: z.enum(CALL_ASSIST_PROMPT_KEYS),
  body: z.string().min(1).max(20_000),
});

export const callAssistPromptRollbackSchema = z.object({
  promptId: z.enum(CALL_ASSIST_PROMPT_KEYS),
  version: z.number().int().min(1),
});

export type PromptDiffLine = { type: "same" | "add" | "del"; text: string };

export function diffPromptText(previous: string, next: string): PromptDiffLine[] {
  const a = previous.split(/\r?\n/);
  const b = next.split(/\r?\n/);
  const out: PromptDiffLine[] = [];
  let i = 0;
  let j = 0;
  while (i < a.length || j < b.length) {
    if (i < a.length && j < b.length && a[i] === b[j]) {
      out.push({ type: "same", text: a[i] ?? "" });
      i += 1;
      j += 1;
      continue;
    }
    if (j < b.length && (i >= a.length || !a.slice(i + 1, i + 6).includes(b[j] ?? ""))) {
      out.push({ type: "add", text: b[j] ?? "" });
      j += 1;
      continue;
    }
    if (i < a.length) {
      out.push({ type: "del", text: a[i] ?? "" });
      i += 1;
      continue;
    }
    out.push({ type: "add", text: b[j] ?? "" });
    j += 1;
  }
  return out;
}

export function applyPromptUpsert(
  existing: CallAssistPromptRecord | null,
  input: { agencyId: string; promptId: CallAssistPromptKey; body: string; actorId: string; at: string },
): CallAssistPromptRecord {
  if (!existing) {
    return {
      promptId: input.promptId,
      agencyId: input.agencyId,
      body: input.body,
      version: 1,
      updatedAt: input.at,
      updatedBy: input.actorId,
      previous: [],
    };
  }
  if (existing.body === input.body) return existing;
  const previous = [
    {
      version: existing.version,
      body: existing.body,
      updatedAt: existing.updatedAt,
      updatedBy: existing.updatedBy,
    },
    ...existing.previous,
  ].slice(0, 25);
  return {
    ...existing,
    body: input.body,
    version: existing.version + 1,
    updatedAt: input.at,
    updatedBy: input.actorId,
    previous,
  };
}

export function rollbackPrompt(
  record: CallAssistPromptRecord,
  version: number,
  actorId: string,
  at: string,
): CallAssistPromptRecord | null {
  const snap = record.previous.find((p) => p.version === version);
  if (!snap) return null;
  return applyPromptUpsert(record, {
    agencyId: record.agencyId,
    promptId: record.promptId,
    body: snap.body,
    actorId,
    at,
  });
}

export const DEFAULT_CALL_ASSIST_PROMPTS: Record<Exclude<CallAssistPromptKey, "dispatchTriage">, string> = {
  opening:
    "Thank you for calling {agencyDisplayName} non-emergency. I'm an automated assistant that will gather your information and route your call. This call may be recorded. If this is a life-threatening emergency, please hang up and dial {emergencyLine}, or say emergency now. How can I help you today?",
  emergencyTransfer:
    "This is the non-emergency line. For life-threatening emergencies, please hang up and dial {emergencyLine} now. I'm also alerting a {agencyShortName} {officerLabel}.",
  humanTransfer: "Of course. I'm connecting you to a {agencyShortName} {officerLabel} now. Stay on the line.",
  fallbackTransfer:
    "I'm sorry, I'm having trouble understanding. Let me connect you to a {agencyDisplayName} {officerLabel} who can help. Stay on the line.",
  incidentCreated:
    "I've created a report for {agencyDisplayName}. Your reference number is {referenceNumber}. A {officerLabel} will follow up.",
  onlineReportEligible:
    "This incident may be eligible for online reporting. Would you like me to text you a secure link to file your report online?",
  carfaxEligible:
    "Your vehicle incident may be eligible for the vehicle reporting program. Would you like me to text you a secure link?",
  callbackOffer:
    "If you prefer, we can schedule a callback instead of holding. Would you like us to call you back at this number?",
  smsOffer: "Would you like me to text you a secure link to finish this report online?",
};

export function promptPackVersionLabel(records: CallAssistPromptRecord[]): string {
  if (!records.length) return "defaults";
  const max = Math.max(...records.map((r) => r.version));
  return `cms-v${max}`;
}

export const CALL_ASSIST_PROMPT_PROPOSAL_STATUSES = [
  "draft",
  "pending_approval",
  "approved",
  "rejected",
  "published",
  "withdrawn",
] as const;
export type CallAssistPromptProposalStatus = (typeof CALL_ASSIST_PROMPT_PROPOSAL_STATUSES)[number];

export const callAssistPromptProposalSchema = z.object({
  proposalId: z.string().min(1).max(128),
  agencyId: z.string().min(1).max(128),
  promptId: z.enum(CALL_ASSIST_PROMPT_KEYS),
  source: z.enum(["qa_finding", "manual"]),
  sourceReviewId: z.string().max(128).optional(),
  sessionId: z.string().max(128).optional(),
  findingSummary: z.string().min(1).max(2000),
  currentBody: z.string().max(20_000),
  proposedBody: z.string().min(1).max(20_000),
  status: z.enum(CALL_ASSIST_PROMPT_PROPOSAL_STATUSES),
  submittedBy: z.string().min(1).max(128),
  submittedAt: z.string().min(1),
  reviewedBy: z.string().max(128).optional(),
  reviewedAt: z.string().max(40).optional(),
  reviewNotes: z.string().max(2000).optional(),
  publishedVersion: z.number().int().min(1).optional(),
});
export type CallAssistPromptProposal = z.infer<typeof callAssistPromptProposalSchema>;

export const callAssistPromptProposeBodySchema = z.object({
  sessionId: z.string().min(1).max(128),
  promptId: z.enum(CALL_ASSIST_PROMPT_KEYS).optional(),
  proposedBody: z.string().min(1).max(20_000).optional(),
  findingSummary: z.string().max(2000).optional(),
});

export const callAssistPromptProposalDecisionSchema = z.object({
  proposalId: z.string().min(1).max(128),
  decision: z.enum(["approve", "reject", "withdraw"]),
  reviewNotes: z.string().max(2000).optional(),
});

export function promptIdFromQaFinding(opts: {
  falseTransfer?: boolean;
  failedChecklistIds?: string[];
}): CallAssistPromptKey {
  if (opts.falseTransfer || opts.failedChecklistIds?.includes("emergency_gate")) return "emergencyTransfer";
  if (opts.failedChecklistIds?.includes("disclosure")) return "opening";
  if (opts.failedChecklistIds?.includes("handoff")) return "humanTransfer";
  if (opts.failedChecklistIds?.includes("self_service")) return "smsOffer";
  if (opts.failedChecklistIds?.includes("containment")) return "fallbackTransfer";
  return "fallbackTransfer";
}

export function draftPromptFromQa(opts: {
  currentBody: string;
  findingSummary: string;
  notes?: string;
}): string {
  const note = (opts.notes ?? "").trim();
  const finding = opts.findingSummary.trim();
  const suffix = `\n\n[QA coaching — not live until an agency administrator approves]\n${finding}${note ? `\n${note}` : ""}`;
  if (opts.currentBody.includes("[QA coaching")) return opts.currentBody;
  return `${opts.currentBody.trim()}${suffix}`.slice(0, 20_000);
}

export function applyProposalDecision(
  proposal: CallAssistPromptProposal,
  decision: "approve" | "reject" | "withdraw",
  actorId: string,
  at: string,
  notes?: string,
): CallAssistPromptProposal | null {
  if (decision === "withdraw") {
    if (proposal.status !== "draft" && proposal.status !== "pending_approval") return null;
    return { ...proposal, status: "withdrawn", reviewedBy: actorId, reviewedAt: at, reviewNotes: notes };
  }
  if (proposal.status !== "pending_approval" && proposal.status !== "draft") return null;
  if (decision === "reject") {
    return { ...proposal, status: "rejected", reviewedBy: actorId, reviewedAt: at, reviewNotes: notes };
  }
  return { ...proposal, status: "approved", reviewedBy: actorId, reviewedAt: at, reviewNotes: notes };
}
