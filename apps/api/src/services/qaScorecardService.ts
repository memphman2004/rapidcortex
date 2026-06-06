import { isSupervisorOrAdmin } from "rapid-cortex-security";
import { AUDIT_EVENT_TYPES } from "rapid-cortex-security";
import type {
  CreateQaScorecardBody,
  PatchQaScorecardBody,
  QaScorecard,
  UserContext,
} from "rapid-cortex-shared";
import {
  computeQaOverallScore,
  defaultQaScorecardItems,
  isRcsuperadmin,
  PLATFORM_AGENCY_ID,
} from "rapid-cortex-shared";
import { makeId } from "../lib/ids.js";
import { env } from "../lib/env.js";
import { AuditRepository } from "../repositories/auditRepository.js";
import { QaScorecardRepository } from "../repositories/qaScorecardRepository.js";

const repo = new QaScorecardRepository();
const auditRepo = new AuditRepository();

function nowIso(): string {
  return new Date().toISOString();
}

function assertInfra(user?: UserContext): void {
  if (!env.qaScorecardsTable) throw new Error("QA_SCORECARDS_DISABLED");
  if (user?.agencyId === PLATFORM_AGENCY_ID) {
    const err = new Error("FORBIDDEN");
    (err as Error & { statusCode?: number }).statusCode = 403;
    throw err;
  }
}

function assertAgency(user: UserContext, agencyId: string): void {
  if (isRcsuperadmin(user)) return;
  if (user.agencyId !== agencyId) {
    const err = new Error("TENANT_MISMATCH");
    (err as Error & { statusCode?: number }).statusCode = 403;
    throw err;
  }
}

function isSupervisor(user: UserContext): boolean {
  return isSupervisorOrAdmin(user.role);
}

function canRead(user: UserContext, card: QaScorecard): boolean {
  if (isRcsuperadmin(user)) return true;
  if (user.agencyId !== card.agencyId) return false;
  if (isSupervisor(user)) return true;
  return user.userId === card.dispatcherId;
}

export class QaScorecardService {
  async create(user: UserContext, body: CreateQaScorecardBody): Promise<QaScorecard> {
    assertInfra(user);
    if (!isSupervisor(user)) {
      const err = new Error("FORBIDDEN");
      (err as Error & { statusCode?: number }).statusCode = 403;
      throw err;
    }

    const items = body.items ?? defaultQaScorecardItems();
    const ts = nowIso();
    const status = body.status ?? "draft";
    const card: QaScorecard = {
      scorecardId: makeId("qa_sc"),
      agencyId: user.agencyId,
      incidentId: body.incidentId,
      reviewerId: user.userId,
      dispatcherId: body.dispatcherId,
      items,
      overallScore: computeQaOverallScore(items),
      coachingNotes: body.coachingNotes,
      followUpRequired: body.followUpRequired ?? false,
      status,
      createdAt: ts,
      updatedAt: ts,
    };

    await repo.put(card);
    await auditRepo.create({
      eventId: makeId("audit"),
      agencyId: user.agencyId,
      actorId: user.userId,
      type: AUDIT_EVENT_TYPES.QA_SESSION_CREATED,
      details: { scorecardId: card.scorecardId, incidentId: card.incidentId, dispatcherId: card.dispatcherId },
      createdAt: ts,
      resourceType: "unknown",
      resourceId: card.scorecardId,
    });
    return card;
  }

  async list(
    user: UserContext,
    query: { incidentId?: string; dispatcherId?: string; limit?: number },
  ): Promise<QaScorecard[]> {
    assertInfra(user);
    const limit = query.limit ?? 50;

    if (query.incidentId) {
      const items = await repo.listByIncident(user.agencyId, query.incidentId, limit);
      return items.filter((c) => canRead(user, c));
    }

    if (query.dispatcherId) {
      if (!isSupervisor(user) && user.userId !== query.dispatcherId) {
        const err = new Error("FORBIDDEN");
        (err as Error & { statusCode?: number }).statusCode = 403;
        throw err;
      }
      return repo.listByDispatcher(user.agencyId, query.dispatcherId, limit);
    }

    if (!isSupervisor(user)) {
      return repo.listByDispatcher(user.agencyId, user.userId, limit);
    }
    return repo.listForAgency(user.agencyId, limit);
  }

  async get(user: UserContext, scorecardId: string): Promise<QaScorecard> {
    assertInfra(user);
    const card = await repo.get(user.agencyId, scorecardId);
    if (!card) {
      const err = new Error("NOT_FOUND");
      (err as Error & { statusCode?: number }).statusCode = 404;
      throw err;
    }
    assertAgency(user, card.agencyId);
    if (!canRead(user, card)) {
      const err = new Error("FORBIDDEN");
      (err as Error & { statusCode?: number }).statusCode = 403;
      throw err;
    }
    return card;
  }

  async patch(user: UserContext, scorecardId: string, body: PatchQaScorecardBody): Promise<QaScorecard> {
    assertInfra(user);
    if (!isSupervisor(user)) {
      const err = new Error("FORBIDDEN");
      (err as Error & { statusCode?: number }).statusCode = 403;
      throw err;
    }

    const existing = await this.get(user, scorecardId);
    const items = body.items ?? existing.items;
    const ts = nowIso();
    const updated = await repo.patch(user.agencyId, scorecardId, {
      items: body.items,
      overallScore: body.items ? computeQaOverallScore(items) : undefined,
      coachingNotes: body.coachingNotes,
      followUpRequired: body.followUpRequired,
      status: body.status,
      updatedAt: ts,
    });
    if (!updated) {
      const err = new Error("NOT_FOUND");
      (err as Error & { statusCode?: number }).statusCode = 404;
      throw err;
    }

    await auditRepo.create({
      eventId: makeId("audit"),
      agencyId: user.agencyId,
      actorId: user.userId,
      type: AUDIT_EVENT_TYPES.QA_SESSION_UPDATED,
      details: { scorecardId, status: updated.status },
      createdAt: ts,
      resourceType: "unknown",
      resourceId: scorecardId,
    });
    return updated;
  }

  async acknowledge(user: UserContext, scorecardId: string): Promise<QaScorecard> {
    assertInfra(user);
    const existing = await this.get(user, scorecardId);
    if (user.userId !== existing.dispatcherId) {
      const err = new Error("FORBIDDEN");
      (err as Error & { statusCode?: number }).statusCode = 403;
      throw err;
    }
    if (existing.status !== "submitted") {
      const err = new Error("INVALID_STATE");
      (err as Error & { statusCode?: number }).statusCode = 400;
      throw err;
    }

    const ts = nowIso();
    const updated = await repo.patch(user.agencyId, scorecardId, {
      status: "acknowledged",
      acknowledgedAt: ts,
      updatedAt: ts,
    });
    if (!updated) {
      const err = new Error("NOT_FOUND");
      (err as Error & { statusCode?: number }).statusCode = 404;
      throw err;
    }

    await auditRepo.create({
      eventId: makeId("audit"),
      agencyId: user.agencyId,
      actorId: user.userId,
      type: AUDIT_EVENT_TYPES.QA_SESSION_UPDATED,
      details: { scorecardId, acknowledged: true },
      createdAt: ts,
      resourceType: "unknown",
      resourceId: scorecardId,
    });
    return updated;
  }
}
