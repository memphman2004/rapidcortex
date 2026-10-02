import { randomUUID } from "node:crypto";
import { AuthorizationService } from "rapid-cortex-security";
import { AUDIT_EVENT_TYPES } from "rapid-cortex-security";
import type {
  CreateQAProtocolTemplateInput,
  CreateQASessionInput,
  PatchQAProtocolTemplateInput,
  PatchQASessionInput,
  QAProtocolTemplate,
  QASession,
  UserContext,
} from "rapid-cortex-shared";
import { isRcsuperadmin, PLATFORM_AGENCY_ID } from "rapid-cortex-shared";
import { makeId } from "../lib/ids.js";
import { AuditRepository } from "../repositories/auditRepository.js";
import { IncidentRepository } from "../repositories/incidentRepository.js";
import { QARepository } from "../repositories/qaRepository.js";
import { TranscriptRepository } from "../repositories/transcriptRepository.js";
import { env } from "../lib/env.js";
import { runStructuredQaScore } from "./qaScoring.js";

const authz = new AuthorizationService();
const qaRepo = new QARepository();
const incidents = new IncidentRepository();
const transcripts = new TranscriptRepository();
const auditRepo = new AuditRepository();

function nowIso(): string {
  return new Date().toISOString();
}

function assertQaInfra(user?: UserContext): void {
  if (!env.enableQaScoring) throw new Error("QA_DISABLED");
  if (!env.qaSessionsTable || !env.qaTemplatesTable) throw new Error("QA_TABLES_NOT_CONFIGURED");
  if (user?.agencyId === PLATFORM_AGENCY_ID) {
    const err = new Error("FORBIDDEN");
    (err as Error & { statusCode?: number }).statusCode = 403;
    throw err;
  }
}

function assertSameAgency(user: UserContext, agencyId: string): void {
  if (isRcsuperadmin(user)) return;
  if (user.agencyId !== agencyId) {
    const err = new Error("TENANT_MISMATCH");
    (err as Error & { statusCode?: number }).statusCode = 403;
    throw err;
  }
}

function canReadSession(user: UserContext, session: QASession): boolean {
  if (isRcsuperadmin(user)) return true;
  if (user.agencyId !== session.agencyId) return false;
  if (authz.canAccessSupervisorRoutes(user)) return true;
  return user.userId === session.dispatcherUserId;
}

function canWriteSession(user: UserContext, session: QASession): boolean {
  if (isRcsuperadmin(user)) return true;
  if (user.agencyId !== session.agencyId) return false;
  if (authz.canAccessSupervisorRoutes(user)) return true;
  return user.userId === session.dispatcherUserId;
}

export class QAService {
  async createSession(user: UserContext, body: CreateQASessionInput): Promise<QASession> {
    assertQaInfra(user);
    const incident = await incidents.get(body.incidentId);
    if (!incident) {
      const err = new Error("NOT_FOUND");
      (err as Error & { statusCode?: number }).statusCode = 404;
      throw err;
    }
    assertSameAgency(user, incident.agencyId);
    const tpl = await qaRepo.getTemplate(incident.agencyId, body.templateId);
    if (!tpl) {
      const err = new Error("TEMPLATE_NOT_FOUND");
      (err as Error & { statusCode?: number }).statusCode = 404;
      throw err;
    }
    if (user.role === "auditor") {
      const err = new Error("FORBIDDEN");
      (err as Error & { statusCode?: number }).statusCode = 403;
      throw err;
    }
    if (user.role !== "dispatcher") {
      const err = new Error("FORBIDDEN");
      (err as Error & { statusCode?: number }).statusCode = 403;
      throw err;
    }

    const sessionId = makeId("qa_sess");
    const ts = nowIso();
    const session: QASession = {
      sessionId,
      agencyId: incident.agencyId,
      incidentId: body.incidentId,
      dispatcherUserId: user.userId,
      templateId: tpl.templateId,
      status: "draft",
      checklistItems: tpl.checklistItems.map((c) => ({
        id: c.id,
        label: c.label,
        weight: c.weight,
      })),
      createdAt: ts,
      updatedAt: ts,
    };
    await qaRepo.putSession(session);
    await auditRepo.create({
      eventId: makeId("audit"),
      agencyId: session.agencyId,
      actorId: user.userId,
      type: AUDIT_EVENT_TYPES.QA_SESSION_CREATED,
      details: { sessionId, incidentId: session.incidentId, templateId: session.templateId },
      createdAt: ts,
      resourceType: "session",
      resourceId: sessionId,
    });
    return session;
  }

  async listSessions(user: UserContext): Promise<QASession[]> {
    assertQaInfra(user);
    assertSameAgency(user, user.agencyId);
    const rows = await qaRepo.listSessionsForAgency(user.agencyId, 200);
    if (authz.canAccessSupervisorRoutes(user) || isRcsuperadmin(user)) {
      return rows;
    }
    return rows.filter((r) => r.dispatcherUserId === user.userId);
  }

  async getSession(user: UserContext, sessionId: string): Promise<QASession> {
    assertQaInfra(user);
    const session = await qaRepo.getSession(user.agencyId, sessionId);
    if (!session) {
      const err = new Error("NOT_FOUND");
      (err as Error & { statusCode?: number }).statusCode = 404;
      throw err;
    }
    if (!canReadSession(user, session)) {
      const err = new Error("FORBIDDEN");
      (err as Error & { statusCode?: number }).statusCode = 403;
      throw err;
    }
    return session;
  }

  async patchSession(user: UserContext, sessionId: string, patch: PatchQASessionInput): Promise<QASession> {
    assertQaInfra(user);
    const session = await this.getSession(user, sessionId);
    if (!canWriteSession(user, session)) {
      const err = new Error("FORBIDDEN");
      (err as Error & { statusCode?: number }).statusCode = 403;
      throw err;
    }
    if (
      patch.supervisorNotes !== undefined &&
      !authz.canAccessSupervisorRoutes(user) &&
      !isRcsuperadmin(user)
    ) {
      const err = new Error("FORBIDDEN");
      (err as Error & { statusCode?: number }).statusCode = 403;
      throw err;
    }
    const ts = nowIso();
    const next: QASession = {
      ...session,
      ...patch,
      checklistItems: patch.checklistItems ?? session.checklistItems,
      updatedAt: ts,
    };
    await qaRepo.putSession(next);
    await auditRepo.create({
      eventId: makeId("audit"),
      agencyId: next.agencyId,
      actorId: user.userId,
      type: AUDIT_EVENT_TYPES.QA_SESSION_UPDATED,
      details: { sessionId, patch },
      createdAt: ts,
      resourceType: "session",
      resourceId: sessionId,
    });
    return next;
  }

  async runScoring(user: UserContext, sessionId: string): Promise<QASession> {
    assertQaInfra(user);
    const session = await this.getSession(user, sessionId);
    if (!authz.canAccessSupervisorRoutes(user) && user.userId !== session.dispatcherUserId) {
      const err = new Error("FORBIDDEN");
      (err as Error & { statusCode?: number }).statusCode = 403;
      throw err;
    }
    const tpl = await qaRepo.getTemplate(session.agencyId, session.templateId);
    if (!tpl) {
      const err = new Error("TEMPLATE_NOT_FOUND");
      (err as Error & { statusCode?: number }).statusCode = 404;
      throw err;
    }
    const segs = await transcripts.listByIncident(session.incidentId);
    const text = segs.map((s) => `${s.speaker}: ${s.text}`).join("\n");
    const ts = nowIso();
    await qaRepo.putSession({ ...session, status: "scoring", updatedAt: ts });
    try {
      const { score, modelId, raw } = await runStructuredQaScore(text, tpl);
      const merged = session.checklistItems.map((c) => {
        const hit = score.checklist.find((x) => x.id === c.id);
        const quote = hit?.evidenceQuote?.trim();
        return {
          ...c,
          score: hit?.score,
          passed: hit?.passed,
          notes: hit?.rationale,
          evidenceQuote: quote && quote.length > 0 ? quote : undefined,
        };
      });
      const done: QASession = {
        ...session,
        status: "scored",
        checklistItems: merged,
        aggregateScore: score.aggregateScore,
        scoringModelId: modelId,
        scoringRaw: raw,
        updatedAt: nowIso(),
      };
      await qaRepo.putSession(done);
      await auditRepo.create({
        eventId: makeId("audit"),
        agencyId: done.agencyId,
        actorId: user.userId,
        type: AUDIT_EVENT_TYPES.QA_SESSION_SCORED,
        details: { sessionId, aggregateScore: done.aggregateScore },
        createdAt: done.updatedAt,
        resourceType: "session",
        resourceId: sessionId,
      });
      return done;
    } catch (e) {
      const failTs = nowIso();
      await qaRepo.putSession({ ...session, status: "failed", updatedAt: failTs });
      await auditRepo.create({
        eventId: makeId("audit"),
        agencyId: session.agencyId,
        actorId: user.userId,
        type: AUDIT_EVENT_TYPES.QA_SESSION_SCORING_FAILED,
        details: { sessionId, message: e instanceof Error ? e.message : String(e) },
        createdAt: failTs,
        resourceType: "session",
        resourceId: sessionId,
      });
      throw e;
    }
  }

  /**
   * After AI incident analysis succeeds, optionally run QA scoring for pending sessions on the same incident.
   * Best-effort: failures do not propagate to the analysis caller.
   */
  async runPendingScoringAfterAnalysis(user: UserContext, agencyId: string, incidentId: string): Promise<void> {
    if (!env.enableQaScoring || !env.enableQaScoreAfterAnalysis) return;
    if (!env.qaSessionsTable || !env.qaTemplatesTable) return;
    if (user.agencyId !== agencyId && !isRcsuperadmin(user)) return;
    const pending = (await qaRepo.listSessionsForIncident(agencyId, incidentId)).filter(
      (s) => s.status === "draft" || s.status === "failed",
    );
    const maxSessions = 3;
    for (const s of pending.slice(0, maxSessions)) {
      try {
        await this.runScoring(user, s.sessionId);
      } catch {
        /* audited inside runScoring; analysis path must not fail */
      }
    }
  }

  async listTemplates(user: UserContext): Promise<QAProtocolTemplate[]> {
    assertQaInfra(user);
    if (!authz.canDispatch(user)) {
      const err = new Error("FORBIDDEN");
      (err as Error & { statusCode?: number }).statusCode = 403;
      throw err;
    }
    assertSameAgency(user, user.agencyId);
    return qaRepo.listTemplatesForAgency(user.agencyId);
  }

  async createTemplate(user: UserContext, body: CreateQAProtocolTemplateInput): Promise<QAProtocolTemplate> {
    assertQaInfra(user);
    if (!authz.canAccessAdminRoutes(user) && !isRcsuperadmin(user)) {
      const err = new Error("FORBIDDEN");
      (err as Error & { statusCode?: number }).statusCode = 403;
      throw err;
    }
    assertSameAgency(user, user.agencyId);
    const templateId = `tpl_${randomUUID().slice(0, 12)}`;
    const ts = nowIso();
    const row: QAProtocolTemplate = {
      templateId,
      agencyId: user.agencyId,
      name: body.name,
      version: 1,
      description: body.description,
      checklistItems: body.checklistItems.map((c) => ({
        id: c.id,
        label: c.label,
        weight: c.weight,
      })),
      createdAt: ts,
      updatedAt: ts,
    };
    await qaRepo.putTemplate(row);
    await auditRepo.create({
      eventId: makeId("audit"),
      agencyId: row.agencyId,
      actorId: user.userId,
      type: AUDIT_EVENT_TYPES.QA_TEMPLATE_CREATED,
      details: { templateId, name: row.name },
      createdAt: ts,
      resourceType: "agency",
      resourceId: templateId,
    });
    return row;
  }

  async patchTemplate(
    user: UserContext,
    templateId: string,
    patch: PatchQAProtocolTemplateInput,
  ): Promise<QAProtocolTemplate> {
    assertQaInfra(user);
    if (!authz.canAccessAdminRoutes(user) && !isRcsuperadmin(user)) {
      const err = new Error("FORBIDDEN");
      (err as Error & { statusCode?: number }).statusCode = 403;
      throw err;
    }
    const existing = await qaRepo.getTemplate(user.agencyId, templateId);
    if (!existing) {
      const err = new Error("NOT_FOUND");
      (err as Error & { statusCode?: number }).statusCode = 404;
      throw err;
    }
    const ts = nowIso();
    const bumped =
      patch.checklistItems != null || patch.name != null || patch.description != null
        ? existing.version + 1
        : existing.version;
    const next: QAProtocolTemplate = {
      ...existing,
      name: patch.name ?? existing.name,
      description: patch.description ?? existing.description,
      checklistItems: patch.checklistItems ?? existing.checklistItems,
      version: patch.version ?? bumped,
      updatedAt: ts,
    };
    await qaRepo.putTemplate(next);
    await auditRepo.create({
      eventId: makeId("audit"),
      agencyId: next.agencyId,
      actorId: user.userId,
      type: AUDIT_EVENT_TYPES.QA_TEMPLATE_UPDATED,
      details: { templateId, patch },
      createdAt: ts,
      resourceType: "agency",
      resourceId: templateId,
    });
    return next;
  }

  async deleteTemplate(user: UserContext, templateId: string): Promise<void> {
    assertQaInfra(user);
    if (!authz.canAccessAdminRoutes(user) && !isRcsuperadmin(user)) {
      const err = new Error("FORBIDDEN");
      (err as Error & { statusCode?: number }).statusCode = 403;
      throw err;
    }
    const existing = await qaRepo.getTemplate(user.agencyId, templateId);
    if (!existing) {
      const err = new Error("NOT_FOUND");
      (err as Error & { statusCode?: number }).statusCode = 404;
      throw err;
    }
    await qaRepo.deleteTemplate(user.agencyId, templateId);
    const ts = nowIso();
    await auditRepo.create({
      eventId: makeId("audit"),
      agencyId: user.agencyId,
      actorId: user.userId,
      type: AUDIT_EVENT_TYPES.QA_TEMPLATE_DELETED,
      details: { templateId },
      createdAt: ts,
      resourceType: "agency",
      resourceId: templateId,
    });
  }
}
