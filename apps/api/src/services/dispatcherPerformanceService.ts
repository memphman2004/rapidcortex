import type {
  DispatcherActivityBucket,
  DispatcherLeaderboardRow,
  DispatcherPerformanceDetailResponse,
  PostDispatcherCoachingNoteBody,
  SupervisorPerformanceMetricsResponse,
  UserContext,
} from "rapid-cortex-shared";
import { AuthorizationService, AUDIT_EVENT_TYPES } from "rapid-cortex-security";
import { AuditRepository } from "../repositories/auditRepository.js";
import { DispatcherCoachingRepository } from "../repositories/dispatcherCoachingRepository.js";
import { makeId } from "../lib/ids.js";
import { env } from "../lib/env.js";

const auditRepo = new AuditRepository();
const coachingRepo = new DispatcherCoachingRepository();
const authz = new AuthorizationService();

function dayKey(iso: string): string {
  return iso.slice(0, 10);
}

function rollupTranscriptAppendsByDispatcher(events: import("rapid-cortex-shared").AuditEvent[]): {
  totals: Record<string, number>;
  byDay: Record<string, Record<string, number>>;
} {
  const totals: Record<string, number> = {};
  const byDay: Record<string, Record<string, number>> = {};
  for (const e of events) {
    if (e.type !== AUDIT_EVENT_TYPES.TRANSCRIPT_APPEND) continue;
    const uid = e.actorId;
    if (!uid) continue;
    totals[uid] = (totals[uid] ?? 0) + 1;
    const dk = dayKey(e.createdAt);
    if (!byDay[dk]) byDay[dk] = {};
    byDay[dk][uid] = (byDay[dk][uid] ?? 0) + 1;
  }
  return { totals, byDay };
}

function leaderboardFromTotals(totals: Record<string, number>): DispatcherLeaderboardRow[] {
  return Object.entries(totals)
    .map(([dispatcherUserId, transcriptAppends]) => ({ dispatcherUserId, transcriptAppends }))
    .sort((a, b) => b.transcriptAppends - a.transcriptAppends)
    .slice(0, 40);
}

function activityForUser(
  dispatcherUserId: string,
  byDay: Record<string, Record<string, number>>,
  days: string[],
): DispatcherActivityBucket[] {
  return days.map((day) => ({
    day,
    transcriptAppends: byDay[day]?.[dispatcherUserId] ?? 0,
  }));
}

function enumerateDays(fromIso: string, toIso: string): string[] {
  const a = new Date(fromIso).getTime();
  const b = new Date(toIso).getTime();
  if (!Number.isFinite(a) || !Number.isFinite(b) || b < a) return [];
  const out: string[] = [];
  for (let t = a; t <= b; t += 24 * 60 * 60 * 1000) {
    out.push(new Date(t).toISOString().slice(0, 10));
  }
  return out;
}

export class DispatcherPerformanceService {
  assertSupervisor(user: UserContext): void {
    if (!authz.canAccessSupervisorRoutes(user)) {
      const err = new Error("FORBIDDEN");
      (err as Error & { statusCode?: number }).statusCode = 403;
      throw err;
    }
  }

  async metrics(
    user: UserContext,
    query: { from?: string; to?: string; compareFrom?: string; compareTo?: string },
  ): Promise<SupervisorPerformanceMetricsResponse> {
    this.assertSupervisor(user);
    const to = query.to ?? new Date().toISOString();
    const from =
      query.from ?? new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const events = await auditRepo.listByAgencyBetween(user.agencyId, from, to);
    const { totals } = rollupTranscriptAppendsByDispatcher(events);
    const leaderboard = leaderboardFromTotals(totals);

    let comparisonLeaderboard: DispatcherLeaderboardRow[] | undefined;
    let comparison: { from: string; to: string } | undefined;
    if (query.compareFrom && query.compareTo) {
      comparison = { from: query.compareFrom, to: query.compareTo };
      const ev2 = await auditRepo.listByAgencyBetween(
        user.agencyId,
        query.compareFrom,
        query.compareTo,
      );
      comparisonLeaderboard = leaderboardFromTotals(rollupTranscriptAppendsByDispatcher(ev2).totals);
    }

    return {
      agencyId: user.agencyId,
      period: { from, to },
      comparison,
      leaderboard,
      comparisonLeaderboard,
    };
  }

  async dispatcherDetail(
    user: UserContext,
    dispatcherUserId: string,
    query: { from?: string; to?: string; compareFrom?: string; compareTo?: string },
  ): Promise<DispatcherPerformanceDetailResponse> {
    this.assertSupervisor(user);
    const to = query.to ?? new Date().toISOString();
    const from =
      query.from ?? new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const events = await auditRepo.listByAgencyBetween(user.agencyId, from, to);
    const { byDay: byDay1 } = rollupTranscriptAppendsByDispatcher(events);
    const days1 = enumerateDays(from, to);
    const activity = activityForUser(dispatcherUserId, byDay1, days1);

    let comparisonActivity: DispatcherActivityBucket[] | undefined;
    let comparison: { from: string; to: string } | undefined;
    if (query.compareFrom && query.compareTo) {
      comparison = { from: query.compareFrom, to: query.compareTo };
      const ev2 = await auditRepo.listByAgencyBetween(
        user.agencyId,
        query.compareFrom,
        query.compareTo,
      );
      const { byDay: byDay2 } = rollupTranscriptAppendsByDispatcher(ev2);
      const days2 = enumerateDays(query.compareFrom, query.compareTo);
      comparisonActivity = activityForUser(dispatcherUserId, byDay2, days2);
    }

    const coachingNotes = await coachingRepo.listForDispatcher(user.agencyId, dispatcherUserId, {
      limit: 50,
    });

    return {
      agencyId: user.agencyId,
      dispatcherUserId,
      period: { from, to },
      comparison,
      activity,
      comparisonActivity,
      coachingNotes,
    };
  }

  async postCoachingNote(user: UserContext, body: PostDispatcherCoachingNoteBody): Promise<void> {
    this.assertSupervisor(user);
    if (!env.dispatcherCoachingNotesTable) {
      const err = new Error("FEATURE_DISABLED");
      (err as Error & { statusCode?: number }).statusCode = 404;
      throw err;
    }
    const now = new Date().toISOString();
    const noteId = makeId("coach");
    await coachingRepo.create({
      noteId,
      agencyId: user.agencyId,
      dispatcherUserId: body.dispatcherUserId,
      supervisorUserId: user.userId,
      body: body.body,
      createdAt: now,
    });
    await auditRepo.create({
      eventId: makeId("audit"),
      agencyId: user.agencyId,
      actorId: user.userId,
      type: AUDIT_EVENT_TYPES.DISPATCHER_COACHING_NOTE_CREATED,
      details: {
        noteId,
        dispatcherUserId: body.dispatcherUserId,
        excerpt: body.body.slice(0, 200),
      },
      createdAt: now,
      resourceType: "unknown",
      resourceId: noteId,
    });
  }
}
