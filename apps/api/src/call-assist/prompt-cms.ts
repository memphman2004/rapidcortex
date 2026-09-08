import {
  applyPromptUpsert,
  applyProposalDecision,
  CALL_ASSIST_PROMPT_KEYS,
  DEFAULT_CALL_ASSIST_PROMPTS,
  diffPromptText,
  draftPromptFromQa,
  promptIdFromQaFinding,
  promptPackVersionLabel,
  rollbackPrompt,
  type CallAssistPromptKey,
  type CallAssistPromptProposal,
  type CallAssistPromptRecord,
} from "rapid-cortex-shared";
import { AUDIT_EVENT_TYPES } from "rapid-cortex-security";
import { DISPATCH_ANALYSIS_SYSTEM_PROMPT } from "../ai/prompts.js";
import { makeId } from "../lib/ids.js";
import { AuditRepository } from "../repositories/auditRepository.js";
import { callAssistStore } from "./store.js";

const auditRepo = new AuditRepository();

function defaultBody(promptId: CallAssistPromptKey): string {
  if (promptId === "dispatchTriage") return DISPATCH_ANALYSIS_SYSTEM_PROMPT;
  return DEFAULT_CALL_ASSIST_PROMPTS[promptId];
}

export async function listPromptCms(agencyId: string): Promise<CallAssistPromptRecord[]> {
  const existing = await callAssistStore.listPrompts(agencyId);
  const byId = new Map(existing.map((p) => [p.promptId, p]));
  const now = new Date().toISOString();
  const out: CallAssistPromptRecord[] = [];
  for (const promptId of CALL_ASSIST_PROMPT_KEYS) {
    const row = byId.get(promptId);
    if (row) {
      out.push(row);
      continue;
    }
    out.push({
      promptId,
      agencyId,
      body: defaultBody(promptId),
      version: 0,
      updatedAt: now,
      updatedBy: "system:default",
      previous: [],
    });
  }
  return out;
}

export async function upsertPromptCms(opts: {
  agencyId: string;
  promptId: CallAssistPromptKey;
  body: string;
  actorId: string;
}): Promise<{ record: CallAssistPromptRecord; diff: ReturnType<typeof diffPromptText> }> {
  const existing = await callAssistStore.getPrompt(opts.agencyId, opts.promptId);
  const at = new Date().toISOString();
  const next = applyPromptUpsert(existing, {
    agencyId: opts.agencyId,
    promptId: opts.promptId,
    body: opts.body,
    actorId: opts.actorId,
    at,
  });
  await callAssistStore.putPrompt(next);
  await syncPromptOverrides(opts.agencyId);
  await auditRepo.create({
    eventId: makeId("audit"),
    agencyId: opts.agencyId,
    actorId: opts.actorId,
    type: AUDIT_EVENT_TYPES.CALL_ASSIST_PROMPT_UPDATED,
    details: { promptId: opts.promptId, version: next.version },
    createdAt: at,
    resourceType: "agency",
    resourceId: opts.promptId,
  });
  return { record: next, diff: diffPromptText(existing?.body ?? defaultBody(opts.promptId), next.body) };
}

export async function rollbackPromptCms(opts: {
  agencyId: string;
  promptId: CallAssistPromptKey;
  version: number;
  actorId: string;
}): Promise<CallAssistPromptRecord> {
  const existing = await callAssistStore.getPrompt(opts.agencyId, opts.promptId);
  if (!existing) throw new Error("PROMPT_NOT_FOUND");
  const at = new Date().toISOString();
  const next = rollbackPrompt(existing, opts.version, opts.actorId, at);
  if (!next) throw new Error("PROMPT_VERSION_NOT_FOUND");
  await callAssistStore.putPrompt(next);
  await syncPromptOverrides(opts.agencyId);
  await auditRepo.create({
    eventId: makeId("audit"),
    agencyId: opts.agencyId,
    actorId: opts.actorId,
    type: AUDIT_EVENT_TYPES.CALL_ASSIST_PROMPT_ROLLED_BACK,
    details: { promptId: opts.promptId, toVersion: opts.version, newVersion: next.version },
    createdAt: at,
    resourceType: "agency",
    resourceId: opts.promptId,
  });
  return next;
}

async function syncPromptOverrides(agencyId: string): Promise<void> {
  const prompts = await callAssistStore.listPrompts(agencyId);
  const overrides: Record<string, string> = {};
  for (const p of prompts) {
    if (p.promptId === "dispatchTriage") continue;
    if (p.version > 0) overrides[p.promptId] = p.body;
  }
  const cfg = await callAssistStore.getConfig(agencyId);
  if (!cfg) return;
  cfg.promptOverrides = overrides;
  cfg.promptPackVersion = promptPackVersionLabel(prompts);
  cfg.updatedAt = new Date().toISOString();
  await callAssistStore.putConfig(cfg);
}

export async function resolveDispatchTriagePrompt(agencyId: string): Promise<{ body: string; versionLabel: string }> {
  const row = await callAssistStore.getPrompt(agencyId, "dispatchTriage").catch(() => null);
  if (row?.body && row.version > 0) {
    return { body: row.body, versionLabel: `cms-v${row.version}` };
  }
  return { body: DISPATCH_ANALYSIS_SYSTEM_PROMPT, versionLabel: "dispatch-triage-v2" };
}

export async function proposePromptFromQa(opts: {
  agencyId: string;
  sessionId: string;
  actorId: string;
  promptId?: CallAssistPromptKey;
  proposedBody?: string;
  findingSummary?: string;
}): Promise<CallAssistPromptProposal> {
  const session = await callAssistStore.getSession(opts.agencyId, opts.sessionId);
  if (!session) throw new Error("SESSION_NOT_FOUND");
  const review = await callAssistStore.getQaReview(opts.agencyId, opts.sessionId);
  const failed = (review?.checklist ?? []).filter((c) => !c.passed).map((c) => c.id);
  const promptId = opts.promptId ?? promptIdFromQaFinding({ falseTransfer: review?.falseTransfer, failedChecklistIds: failed });
  const current = (await listPromptCms(opts.agencyId)).find((p) => p.promptId === promptId);
  const currentBody = current?.body ?? defaultBody(promptId);
  const finding =
    opts.findingSummary?.trim() ||
    review?.notes?.trim() ||
    (failed.length ? `QA failed: ${failed.join(", ")}` : "QA finding");
  const proposedBody = opts.proposedBody?.trim() || draftPromptFromQa({ currentBody, findingSummary: finding, notes: review?.notes });
  const at = new Date().toISOString();
  const proposal: CallAssistPromptProposal = {
    proposalId: makeId("prp"),
    agencyId: opts.agencyId,
    promptId,
    source: "qa_finding",
    sourceReviewId: review?.reviewId,
    sessionId: opts.sessionId,
    findingSummary: finding.slice(0, 2000),
    currentBody,
    proposedBody,
    status: "pending_approval",
    submittedBy: opts.actorId,
    submittedAt: at,
  };
  await callAssistStore.putPromptProposal(proposal);
  await auditRepo.create({
    eventId: makeId("audit"),
    agencyId: opts.agencyId,
    actorId: opts.actorId,
    type: AUDIT_EVENT_TYPES.CALL_ASSIST_PROMPT_PROPOSAL,
    details: { proposalId: proposal.proposalId, promptId, status: proposal.status, sessionId: opts.sessionId },
    createdAt: at,
    resourceType: "agency",
    resourceId: proposal.proposalId,
  });
  return proposal;
}

export async function decidePromptProposal(opts: {
  agencyId: string;
  proposalId: string;
  actorId: string;
  decision: "approve" | "reject" | "withdraw";
  reviewNotes?: string;
}): Promise<CallAssistPromptProposal> {
  const existing = await callAssistStore.getPromptProposal(opts.agencyId, opts.proposalId);
  if (!existing) throw new Error("PROPOSAL_NOT_FOUND");
  const at = new Date().toISOString();
  const next = applyProposalDecision(existing, opts.decision, opts.actorId, at, opts.reviewNotes);
  if (!next) throw new Error("PROPOSAL_NOT_ACTIONABLE");
  if (opts.decision === "approve") {
    const published = await upsertPromptCms({
      agencyId: opts.agencyId,
      promptId: next.promptId,
      body: next.proposedBody,
      actorId: opts.actorId,
    });
    next.status = "published";
    next.publishedVersion = published.record.version;
  }
  await callAssistStore.putPromptProposal(next);
  await auditRepo.create({
    eventId: makeId("audit"),
    agencyId: opts.agencyId,
    actorId: opts.actorId,
    type: AUDIT_EVENT_TYPES.CALL_ASSIST_PROMPT_PROPOSAL,
    details: { proposalId: next.proposalId, status: next.status, decision: opts.decision },
    createdAt: at,
    resourceType: "agency",
    resourceId: next.proposalId,
  });
  return next;
}
