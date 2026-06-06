import { isSupervisorOrAdmin } from "rapid-cortex-security";
import { AUDIT_EVENT_TYPES } from "rapid-cortex-security";
import type { CoachingNote, CreateCoachingNoteBody, PatchCoachingNoteBody, UserContext } from "rapid-cortex-shared";
import { isRcsuperadmin, PLATFORM_AGENCY_ID } from "rapid-cortex-shared";
import { makeId } from "../lib/ids.js";
import { env } from "../lib/env.js";
import { AuditRepository } from "../repositories/auditRepository.js";
import { CoachingNotesRepository } from "../repositories/coachingNotesRepository.js";

const repo = new CoachingNotesRepository();
const auditRepo = new AuditRepository();

function nowIso(): string {
  return new Date().toISOString();
}

function assertInfra(user?: UserContext): void {
  if (!env.coachingNotesTable) throw new Error("COACHING_NOTES_DISABLED");
  if (user?.agencyId === PLATFORM_AGENCY_ID) {
    const err = new Error("FORBIDDEN");
    (err as Error & { statusCode?: number }).statusCode = 403;
    throw err;
  }
}

function isSupervisor(user: UserContext): boolean {
  return isSupervisorOrAdmin(user.role);
}

export class CoachingNotesService {
  async create(user: UserContext, body: CreateCoachingNoteBody): Promise<CoachingNote> {
    assertInfra(user);
    if (!isSupervisor(user)) {
      const err = new Error("FORBIDDEN");
      (err as Error & { statusCode?: number }).statusCode = 403;
      throw err;
    }

    const ts = nowIso();
    const note: CoachingNote = {
      noteId: makeId("coach_qa"),
      agencyId: user.agencyId,
      dispatcherId: body.dispatcherId,
      supervisorId: user.userId,
      incidentId: body.incidentId,
      scorecardId: body.scorecardId,
      content: body.content,
      tags: body.tags ?? [],
      createdAt: ts,
      updatedAt: ts,
    };

    await repo.put(note);
    await auditRepo.create({
      eventId: makeId("audit"),
      agencyId: user.agencyId,
      actorId: user.userId,
      type: AUDIT_EVENT_TYPES.DISPATCHER_COACHING_NOTE_CREATED,
      details: {
        noteId: note.noteId,
        dispatcherId: note.dispatcherId,
        excerpt: note.content.slice(0, 200),
      },
      createdAt: ts,
      resourceType: "unknown",
      resourceId: note.noteId,
    });
    return note;
  }

  async list(
    user: UserContext,
    query: { dispatcherId: string; limit?: number },
  ): Promise<CoachingNote[]> {
    assertInfra(user);
    if (!isSupervisor(user) && user.userId !== query.dispatcherId) {
      const err = new Error("FORBIDDEN");
      (err as Error & { statusCode?: number }).statusCode = 403;
      throw err;
    }
    return repo.listForDispatcher(user.agencyId, query.dispatcherId, query.limit ?? 50);
  }

  async patch(user: UserContext, noteId: string, body: PatchCoachingNoteBody): Promise<CoachingNote> {
    assertInfra(user);
    if (!isSupervisor(user)) {
      const err = new Error("FORBIDDEN");
      (err as Error & { statusCode?: number }).statusCode = 403;
      throw err;
    }

    const existing = await repo.get(user.agencyId, noteId);
    if (!existing) {
      const err = new Error("NOT_FOUND");
      (err as Error & { statusCode?: number }).statusCode = 404;
      throw err;
    }

    const ts = nowIso();
    const updated = await repo.patch(user.agencyId, noteId, {
      content: body.content,
      tags: body.tags,
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
      type: AUDIT_EVENT_TYPES.DISPATCHER_COACHING_NOTE_CREATED,
      details: { noteId, updated: true },
      createdAt: ts,
      resourceType: "unknown",
      resourceId: noteId,
    });
    return updated;
  }

  async remove(user: UserContext, noteId: string): Promise<void> {
    assertInfra(user);
    if (!isSupervisor(user) && !isRcsuperadmin(user)) {
      const err = new Error("FORBIDDEN");
      (err as Error & { statusCode?: number }).statusCode = 403;
      throw err;
    }

    const existing = await repo.get(user.agencyId, noteId);
    if (!existing) {
      const err = new Error("NOT_FOUND");
      (err as Error & { statusCode?: number }).statusCode = 404;
      throw err;
    }

    const ts = nowIso();
    await repo.softDelete(user.agencyId, noteId, ts);
    await auditRepo.create({
      eventId: makeId("audit"),
      agencyId: user.agencyId,
      actorId: user.userId,
      type: AUDIT_EVENT_TYPES.DISPATCHER_COACHING_NOTE_CREATED,
      details: { noteId, deleted: true },
      createdAt: ts,
      resourceType: "unknown",
      resourceId: noteId,
    });
  }
}
