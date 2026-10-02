import { AUDIT_EVENT_TYPES, isSupervisorOrAdmin } from "rapid-cortex-security";
import type {
  CreatePostIncidentReviewBody,
  PatchPostIncidentReviewBody,
  PostIncidentReview,
  PostIncidentReviewExport,
  PostIncidentReviewStatus,
  UserContext,
} from "rapid-cortex-shared";
import { defaultReviewSections, isRcsuperadmin } from "rapid-cortex-shared";
import { resolveIncidentRead } from "../lib/incidentReadAccess.js";
import { env } from "../lib/env.js";
import { makeId } from "../lib/ids.js";
import { AuditRepository } from "../repositories/auditRepository.js";
import { PostIncidentReviewRepository } from "../repositories/postIncidentReviewRepository.js";

const repo = new PostIncidentReviewRepository();
const auditRepo = new AuditRepository();

function nowIso(): string {
  return new Date().toISOString();
}

function assertInfra(): void {
  if (!env.postIncidentReviewsTable) {
    const err = new Error("POST_INCIDENT_REVIEWS_DISABLED");
    (err as Error & { statusCode?: number }).statusCode = 503;
    throw err;
  }
}

function isSupervisor(user: UserContext): boolean {
  return isSupervisorOrAdmin(user.role);
}

function assertAgency(user: UserContext, agencyId: string): void {
  if (isRcsuperadmin(user)) return;
  if (user.agencyId !== agencyId) {
    const err = new Error("TENANT_MISMATCH");
    (err as Error & { statusCode?: number }).statusCode = 403;
    throw err;
  }
}

function canReadReview(user: UserContext, review: PostIncidentReview): boolean {
  if (isRcsuperadmin(user)) return true;
  if (user.agencyId !== review.agencyId) return false;
  if (review.status === "final" || review.status === "archived") return true;
  return isSupervisor(user);
}

function canEditReview(user: UserContext, review: PostIncidentReview): boolean {
  if (!isSupervisor(user)) return false;
  assertAgency(user, review.agencyId);
  return review.status === "draft";
}

export class PostIncidentReviewService {
  private async assertIncidentAccess(user: UserContext, incidentId: string): Promise<string> {
    const resolved = await resolveIncidentRead(incidentId, user);
    if (!resolved) {
      const err = new Error("NOT_FOUND");
      (err as Error & { statusCode?: number }).statusCode = 404;
      throw err;
    }
    assertAgency(user, resolved.incident.agencyId);
    return resolved.incident.agencyId;
  }

  async create(user: UserContext, body: CreatePostIncidentReviewBody): Promise<PostIncidentReview> {
    assertInfra();
    if (!isSupervisor(user)) {
      const err = new Error("FORBIDDEN");
      (err as Error & { statusCode?: number }).statusCode = 403;
      throw err;
    }
    const agencyId = await this.assertIncidentAccess(user, body.incidentId);
    const ts = nowIso();
    const review: PostIncidentReview = {
      reviewId: makeId("pir"),
      agencyId,
      incidentId: body.incidentId,
      reviewedBy: user.userId,
      status: "draft",
      sections: defaultReviewSections(),
      linkedScorecardIds: body.linkedScorecardIds ?? [],
      linkedTimelineEventIds: body.linkedTimelineEventIds ?? [],
      createdAt: ts,
      updatedAt: ts,
    };
    await repo.put(review);
    await auditRepo.create({
      eventId: makeId("audit"),
      agencyId,
      incidentId: body.incidentId,
      actorId: user.userId,
      type: AUDIT_EVENT_TYPES.POST_INCIDENT_REVIEW_CREATED,
      details: { reviewId: review.reviewId },
      createdAt: ts,
      resourceType: "incident",
      resourceId: review.reviewId,
    });
    return review;
  }

  async list(
    user: UserContext,
    incidentId?: string,
    status?: PostIncidentReviewStatus,
  ): Promise<{ items: PostIncidentReview[] }> {
    assertInfra();
    if (!user.agencyId) {
      const err = new Error("FORBIDDEN");
      (err as Error & { statusCode?: number }).statusCode = 403;
      throw err;
    }
    let items = incidentId
      ? await repo.listByIncident(user.agencyId, incidentId, status)
      : await repo.listForAgency(user.agencyId, status);
    if (!isSupervisor(user)) {
      items = items.filter((r) => r.status === "final" || r.status === "archived");
    }
    items = items.filter((r) => canReadReview(user, r));
    return { items };
  }

  async get(user: UserContext, reviewId: string): Promise<PostIncidentReview> {
    assertInfra();
    if (!user.agencyId) {
      const err = new Error("FORBIDDEN");
      (err as Error & { statusCode?: number }).statusCode = 403;
      throw err;
    }
    const review = await repo.get(user.agencyId, reviewId);
    if (!review) {
      const err = new Error("NOT_FOUND");
      (err as Error & { statusCode?: number }).statusCode = 404;
      throw err;
    }
    if (!canReadReview(user, review)) {
      const err = new Error("FORBIDDEN");
      (err as Error & { statusCode?: number }).statusCode = 403;
      throw err;
    }
    return review;
  }

  async patch(
    user: UserContext,
    reviewId: string,
    body: PatchPostIncidentReviewBody,
  ): Promise<PostIncidentReview> {
    assertInfra();
    const current = await this.get(user, reviewId);
    if (!canEditReview(user, current)) {
      const err = new Error("FORBIDDEN");
      (err as Error & { statusCode?: number }).statusCode = 403;
      throw err;
    }
    const ts = nowIso();
    const nextStatus = body.status ?? current.status;
    const finalizedAt =
      nextStatus === "final" && current.status === "draft" ? ts : current.finalizedAt;
    const updated = await repo.patch(current.agencyId, reviewId, {
      sections: body.sections ?? current.sections,
      linkedScorecardIds: body.linkedScorecardIds ?? current.linkedScorecardIds,
      linkedTimelineEventIds: body.linkedTimelineEventIds ?? current.linkedTimelineEventIds,
      status: nextStatus,
      finalizedAt,
      updatedAt: ts,
    });
    if (!updated) {
      const err = new Error("NOT_FOUND");
      (err as Error & { statusCode?: number }).statusCode = 404;
      throw err;
    }
    const auditType =
      nextStatus === "final" && current.status === "draft"
        ? AUDIT_EVENT_TYPES.POST_INCIDENT_REVIEW_FINALIZED
        : AUDIT_EVENT_TYPES.POST_INCIDENT_REVIEW_UPDATED;
    await auditRepo.create({
      eventId: makeId("audit"),
      agencyId: current.agencyId,
      incidentId: current.incidentId,
      actorId: user.userId,
      type: auditType,
      details: { reviewId, status: nextStatus },
      createdAt: ts,
      resourceType: "incident",
      resourceId: reviewId,
    });
    return updated;
  }

  async export(user: UserContext, reviewId: string): Promise<PostIncidentReviewExport> {
    const review = await this.get(user, reviewId);
    if (review.status !== "final" && review.status !== "archived") {
      const err = new Error("NOT_FINAL");
      (err as Error & { statusCode?: number }).statusCode = 400;
      throw err;
    }
    return { ...review, exportedAt: nowIso() };
  }
}
