import { createHash, randomBytes } from "node:crypto";
import type {
  DiversionAgencyConfig,
  DiversionConfirmBody,
  DiversionConfirmResult,
  DiversionSession,
  DiversionSessionStatus,
  DiversionStartBody,
  DiversionUtteranceBody,
  DiversionUtteranceResult,
  DiversionWorkflow,
  DiversionWorkflowUpsertBody,
} from "rapid-cortex-shared";
import {
  diversionAgencyConfigSchema,
  diversionConfirmResultSchema,
  diversionSessionSchema,
  diversionUtteranceResultSchema,
  diversionWorkflowSchema,
} from "rapid-cortex-shared";
import { AUDIT_EVENT_TYPES } from "rapid-cortex-security";
import { env } from "../../lib/env.js";
import { makeId } from "../../lib/ids.js";
import { sendSilentTextSms } from "../../lib/silentTextSms.js";
import { enqueueQueueItem } from "../../lib/triage/queue-store.js";
import { AuditRepository } from "../../repositories/auditRepository.js";
import { ng911AssistStore } from "./ng911AssistStore.js";

const auditRepo = new AuditRepository();

/** Sessions in these states no longer accept utterance / confirm input. */
const TERMINAL_SESSION_STATUSES: ReadonlySet<DiversionSessionStatus> = new Set([
  "completed",
  "opted_out",
  "sms_sent",
  "failed",
]);

/** Minimum token-overlap fraction (vs. an intent phrase) to count as a match when no substring hit. */
const INTENT_TOKEN_OVERLAP_THRESHOLD = 0.5;

// ─── Public key hashing ────────────────────────────────────────────────────

export function hashPublicKey(plain: string): string {
  return createHash("sha256").update(plain.trim(), "utf8").digest("hex");
}

function generatePlainPublicKey(): string {
  return `dvk_${randomBytes(24).toString("base64url")}`;
}

async function assertValidPublicKey(
  agencyId: string,
  publicKey: string | undefined | null,
): Promise<DiversionAgencyConfig> {
  const config = await ng911AssistStore.getConfig(agencyId);
  if (!config || !config.enabled) throw new Error("DIVERSION_NOT_CONFIGURED");
  const candidate = publicKey?.trim();
  if (!candidate || hashPublicKey(candidate) !== config.publicKeyHash) {
    throw new Error("UNAUTHORIZED_KEY");
  }
  return config;
}

// ─── Intent matching (Arlington-style bucket matching, no ML) ─────────────

export type MatchableWorkflow = Pick<DiversionWorkflow, "workflowId" | "name" | "intents"> & {
  enabled?: boolean;
  sortOrder?: number;
};

export type WorkflowMatch<T extends MatchableWorkflow = MatchableWorkflow> = {
  workflow: T;
  score: number;
};

export function normalizeUtterance(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(text: string): string[] {
  const normalized = normalizeUtterance(text);
  return normalized ? normalized.split(" ") : [];
}

/**
 * Simple, explainable phrase matcher: substring containment wins outright; otherwise the
 * workflow with the highest token-overlap ratio against any of its configured intents wins,
 * provided it clears {@link INTENT_TOKEN_OVERLAP_THRESHOLD}. Mirrors legacy IVR "bucket" logic
 * (e.g. Arlington's non-emergency diversion menus) rather than a statistical/ML classifier.
 */
export function matchWorkflow<T extends MatchableWorkflow>(
  utterance: string,
  workflows: T[],
): WorkflowMatch<T> | null {
  const utteranceNorm = normalizeUtterance(utterance);
  if (!utteranceNorm) return null;
  const utteranceTokens = new Set(tokenize(utterance));

  const candidates = workflows
    .filter((w) => w.enabled !== false)
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));

  let best: WorkflowMatch<T> | null = null;

  for (const workflow of candidates) {
    let bestIntentScore = 0;

    for (const intent of workflow.intents) {
      const intentNorm = normalizeUtterance(intent);
      if (!intentNorm) continue;

      if (utteranceNorm.includes(intentNorm) || intentNorm.includes(utteranceNorm)) {
        bestIntentScore = 1;
        break;
      }

      const intentTokens = tokenize(intent);
      if (!intentTokens.length) continue;
      const overlap = intentTokens.filter((t) => utteranceTokens.has(t)).length;
      const score = overlap / intentTokens.length;
      if (score > bestIntentScore) bestIntentScore = score;
    }

    if (bestIntentScore > 0 && (!best || bestIntentScore > best.score)) {
      best = { workflow, score: bestIntentScore };
    }
  }

  if (!best || best.score < INTENT_TOKEN_OVERLAP_THRESHOLD) return null;
  return best;
}

function buildSmsMessage(workflow: DiversionWorkflow): string {
  if (workflow.smsTemplate?.trim()) {
    return workflow.smsTemplate
      .replaceAll("{portalUrl}", workflow.portalUrl)
      .replaceAll("{workflowName}", workflow.name);
  }
  return `Rapid Cortex Non-Emergency: Report your ${workflow.name} online at ${workflow.portalUrl}. Reply STOP to opt out.`;
}

// ─── Agency config (public key) ───────────────────────────────────────────

export async function getConfig(agencyId: string): Promise<DiversionAgencyConfig | null> {
  return ng911AssistStore.getConfig(agencyId);
}

export async function rotateConfig(
  agencyId: string,
  actorId: string,
  options?: { greeting?: string; enabled?: boolean },
): Promise<{ publicKey: string; config: DiversionAgencyConfig }> {
  const existing = await ng911AssistStore.getConfig(agencyId);
  const plain = generatePlainPublicKey();
  const now = new Date().toISOString();

  const config: DiversionAgencyConfig = diversionAgencyConfigSchema.parse({
    agencyId,
    publicKeyHash: hashPublicKey(plain),
    publicKeyHint: plain.slice(-4),
    greeting: options?.greeting ?? existing?.greeting,
    enabled: options?.enabled ?? existing?.enabled ?? true,
    updatedAt: now,
  });

  await ng911AssistStore.putConfig(config);

  await auditRepo.create({
    eventId: makeId("audit"),
    agencyId,
    actorId,
    type: AUDIT_EVENT_TYPES.DIVERSION_CONFIG_ROTATED,
    details: { publicKeyHint: config.publicKeyHint, rotatedAt: now },
    createdAt: now,
    resourceType: "agency",
    resourceId: agencyId,
  });

  return { publicKey: plain, config };
}

// ─── Workflow admin (CRUD) ─────────────────────────────────────────────────

export async function listWorkflows(agencyId: string): Promise<DiversionWorkflow[]> {
  return ng911AssistStore.listWorkflows(agencyId);
}

export async function upsertWorkflow(
  agencyId: string,
  actorId: string,
  body: DiversionWorkflowUpsertBody,
): Promise<DiversionWorkflow> {
  const now = new Date().toISOString();
  const existing = body.workflowId
    ? await ng911AssistStore.getWorkflow(agencyId, body.workflowId)
    : null;

  const workflow: DiversionWorkflow = diversionWorkflowSchema.parse({
    workflowId: body.workflowId ?? makeId("dvwf"),
    agencyId,
    name: body.name,
    description: body.description,
    intents: body.intents,
    portalUrl: body.portalUrl,
    smsTemplate: body.smsTemplate,
    enabled: body.enabled ?? existing?.enabled ?? true,
    sortOrder: body.sortOrder ?? existing?.sortOrder ?? 0,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    createdBy: existing?.createdBy ?? actorId,
  });

  await ng911AssistStore.putWorkflow(workflow);

  await auditRepo.create({
    eventId: makeId("audit"),
    agencyId,
    actorId,
    type: AUDIT_EVENT_TYPES.DIVERSION_WORKFLOW_UPSERTED,
    details: { workflowId: workflow.workflowId, name: workflow.name, created: !existing },
    createdAt: now,
    resourceType: "agency",
    resourceId: agencyId,
  });

  return workflow;
}

export async function deleteWorkflow(
  agencyId: string,
  actorId: string,
  workflowId: string,
): Promise<void> {
  await ng911AssistStore.deleteWorkflow(agencyId, workflowId);

  await auditRepo.create({
    eventId: makeId("audit"),
    agencyId,
    actorId,
    type: AUDIT_EVENT_TYPES.DIVERSION_WORKFLOW_DELETED,
    details: { workflowId },
    createdAt: new Date().toISOString(),
    resourceType: "agency",
    resourceId: agencyId,
  });
}

// ─── Public IVR / web-chat session flow ───────────────────────────────────

export async function startSession(
  agencyId: string,
  publicKey: string | undefined | null,
  body: DiversionStartBody,
): Promise<{ sessionId: string; status: DiversionSessionStatus; greeting: string }> {
  const config = await assertValidPublicKey(agencyId, publicKey);
  const now = new Date().toISOString();

  const session: DiversionSession = diversionSessionSchema.parse({
    sessionId: makeId("dvs"),
    agencyId,
    status: "started",
    callerPhoneE164: body.callerPhoneE164,
    createdAt: now,
    updatedAt: now,
  });

  await ng911AssistStore.putSession(session);

  await auditRepo.create({
    eventId: makeId("audit"),
    agencyId,
    actorId: "public:diversion",
    type: AUDIT_EVENT_TYPES.DIVERSION_SESSION_STARTED,
    details: { sessionId: session.sessionId },
    createdAt: now,
    resourceType: "agency",
    resourceId: agencyId,
  });

  return { sessionId: session.sessionId, status: session.status, greeting: config.greeting };
}

export async function processUtterance(
  agencyId: string,
  publicKey: string | undefined | null,
  body: DiversionUtteranceBody,
): Promise<DiversionUtteranceResult> {
  await assertValidPublicKey(agencyId, publicKey);

  const session = await ng911AssistStore.getSession(agencyId, body.sessionId);
  if (!session) throw new Error("SESSION_NOT_FOUND");
  if (TERMINAL_SESSION_STATUSES.has(session.status)) throw new Error("SESSION_CLOSED");

  const workflows = await ng911AssistStore.listWorkflows(agencyId);
  const match = matchWorkflow(body.utterance, workflows);
  const now = new Date().toISOString();

  if (match) {
    await ng911AssistStore.touchSession(agencyId, session.sessionId, {
      utterance: body.utterance,
      matchedWorkflowId: match.workflow.workflowId,
      matchedWorkflowName: match.workflow.name,
      status: "awaiting_confirm",
      updatedAt: now,
    });

    await auditRepo.create({
      eventId: makeId("audit"),
      agencyId,
      actorId: "public:diversion",
      type: AUDIT_EVENT_TYPES.DIVERSION_UTTERANCE_MATCHED,
      details: {
        sessionId: session.sessionId,
        workflowId: match.workflow.workflowId,
        score: match.score,
      },
      createdAt: now,
      resourceType: "agency",
      resourceId: agencyId,
    });

    return diversionUtteranceResultSchema.parse({
      sessionId: session.sessionId,
      status: "awaiting_confirm",
      matched: true,
      workflowId: match.workflow.workflowId,
      workflowName: match.workflow.name,
      confirmPrompt: `I can text you a secure link to report this through our ${match.workflow.name} online option. Would you like me to send that link now?`,
      message: `Matched to ${match.workflow.name}.`,
    });
  }

  await ng911AssistStore.touchSession(agencyId, session.sessionId, {
    utterance: body.utterance,
    status: "no_match",
    updatedAt: now,
  });

  return diversionUtteranceResultSchema.parse({
    sessionId: session.sessionId,
    status: "no_match",
    matched: false,
    message:
      "I wasn't able to match that to an online reporting option. You can describe the issue again, or say no to be connected to a dispatcher.",
  });
}

export async function confirm(
  agencyId: string,
  publicKey: string | undefined | null,
  body: DiversionConfirmBody,
): Promise<DiversionConfirmResult> {
  await assertValidPublicKey(agencyId, publicKey);

  const session = await ng911AssistStore.getSession(agencyId, body.sessionId);
  if (!session) throw new Error("SESSION_NOT_FOUND");
  if (TERMINAL_SESSION_STATUSES.has(session.status)) throw new Error("SESSION_CLOSED");

  const now = new Date().toISOString();

  if (body.confirm) {
    if (!session.matchedWorkflowId) {
      throw new Error("VALIDATION:No matched workflow to confirm for this session");
    }
    const workflow = await ng911AssistStore.getWorkflow(agencyId, session.matchedWorkflowId);
    if (!workflow) throw new Error("NOT_FOUND");

    const phone = body.callerPhoneE164 ?? session.callerPhoneE164;
    if (!phone) {
      throw new Error("VALIDATION:A phone number is required to send the reporting link");
    }

    const message = buildSmsMessage(workflow);
    const syntheticIncidentId = `diversion_${session.sessionId}`;
    const smsResult = env.ng911DiversionMockSms
      ? { ok: true as const, provider: "mock" as const, providerRef: "mock" }
      : await sendSilentTextSms({
          phoneE164: phone,
          message,
          agencyId,
          incidentId: syntheticIncidentId,
        });

    if (smsResult.ok) {
      await ng911AssistStore.touchSession(agencyId, session.sessionId, {
        status: "sms_sent",
        smsProviderRef: smsResult.providerRef,
        completedAt: now,
        updatedAt: now,
      });

      await auditRepo.create({
        eventId: makeId("audit"),
        agencyId,
        actorId: "public:diversion",
        type: AUDIT_EVENT_TYPES.DIVERSION_SMS_SENT,
        details: { sessionId: session.sessionId, workflowId: workflow.workflowId },
        createdAt: now,
        resourceType: "agency",
        resourceId: agencyId,
      });

      return diversionConfirmResultSchema.parse({
        sessionId: session.sessionId,
        status: "sms_sent",
        smsSent: true,
        portalUrl: workflow.portalUrl,
        message: "A text message with the reporting link has been sent.",
      });
    }

    await ng911AssistStore.touchSession(agencyId, session.sessionId, {
      status: "failed",
      updatedAt: now,
    });

    await auditRepo.create({
      eventId: makeId("audit"),
      agencyId,
      actorId: "public:diversion",
      type: AUDIT_EVENT_TYPES.DIVERSION_SMS_FAILED,
      details: {
        sessionId: session.sessionId,
        workflowId: workflow.workflowId,
        errorCode: smsResult.errorCode ?? null,
      },
      createdAt: now,
      resourceType: "agency",
      resourceId: agencyId,
    });

    return diversionConfirmResultSchema.parse({
      sessionId: session.sessionId,
      status: "failed",
      smsSent: false,
      message: "We couldn't send the text message. You'll be connected to a dispatcher.",
    });
  }

  // Caller declined the online option — opt out to a live queue when configured.
  let queueIncidentId: string | undefined;
  if (env.nonEmergencyQueueTable) {
    const candidateIncidentId = `diversion_${session.sessionId}`;
    try {
      await enqueueQueueItem({
        agencyId,
        sk: `${now}#${candidateIncidentId}`,
        incidentId: candidateIncidentId,
        classification: "NON_EMERGENCY",
        confidence: 60,
        reasoning: session.matchedWorkflowName
          ? `Caller declined the ${session.matchedWorkflowName} online reporting option during non-emergency diversion.`
          : "Caller opted out of non-emergency diversion and requested a live dispatcher.",
        suggestedCategory: session.matchedWorkflowName ?? "Non-Emergency Diversion",
        suggestedPriority: "P3",
        transcriptSummary: (session.utterance ?? "Non-emergency diversion opt-out.").slice(0, 300),
        queuedAt: now,
      });
      queueIncidentId = candidateIncidentId;
    } catch (err) {
      console.error(
        JSON.stringify({
          type: "diversion.opt_out.enqueue_failed",
          agencyId,
          sessionId: session.sessionId,
          error: err instanceof Error ? err.message : String(err),
        }),
      );
    }
  }

  await ng911AssistStore.touchSession(agencyId, session.sessionId, {
    status: "opted_out",
    queueIncidentId,
    completedAt: now,
    updatedAt: now,
  });

  await auditRepo.create({
    eventId: makeId("audit"),
    agencyId,
    actorId: "public:diversion",
    type: AUDIT_EVENT_TYPES.DIVERSION_OPTED_OUT,
    details: { sessionId: session.sessionId, queueIncidentId: queueIncidentId ?? null },
    createdAt: now,
    resourceType: "agency",
    resourceId: agencyId,
  });

  return diversionConfirmResultSchema.parse({
    sessionId: session.sessionId,
    status: "opted_out",
    queueIncidentId,
    message: "Connecting you to a dispatcher.",
  });
}

// ─── Admin ──────────────────────────────────────────────────────────────

export async function listSessions(agencyId: string, limit = 100): Promise<DiversionSession[]> {
  return ng911AssistStore.listSessions(agencyId, limit);
}
