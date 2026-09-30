import type {
  TranslateAssistanceEncounter,
  TranslateSegment,
  TranslateSession,
  TranslateVertical,
} from "rapid-cortex-shared";
import { AUDIT_EVENT_TYPES } from "rapid-cortex-security";
import { env } from "../lib/env.js";
import { makeId } from "../lib/ids.js";
import { AuditRepository } from "../repositories/auditRepository.js";
import { formatTranscript } from "./summary.js";
import { translateStore } from "./store.js";

const audit = new AuditRepository();

export function formatDuration(startedAt: string, endedAt: string): string {
  const ms = Math.max(0, Date.parse(endedAt) - Date.parse(startedAt));
  const s = Math.round(ms / 1000);
  return `${Math.floor(s / 60)}m ${s % 60}s`;
}

export function linkedIncidentIdForSession(session: TranslateSession): string | undefined {
  return (
    session.incidentId ||
    session.venueContext?.venueIncidentId ||
    session.campusContext?.campusIncidentId ||
    session.hospitalContext?.patientEncounterId ||
    undefined
  );
}

export function hasWritebackTarget(session: TranslateSession, vertical: TranslateVertical): boolean {
  switch (vertical) {
    case "law_enforcement":
      return Boolean(session.incidentId);
    case "venue":
      return Boolean(session.venueContext?.venueIncidentId);
    case "campus":
      return Boolean(session.campusContext?.campusIncidentId);
    case "hospital":
      return Boolean(session.hospitalContext?.patientEncounterId);
  }
}

export function buildAssistanceEncounter(
  session: TranslateSession,
  now = new Date().toISOString(),
): TranslateAssistanceEncounter {
  const endedAt = session.endedAt ?? now;
  const durationSec = Math.max(
    0,
    Math.round((Date.parse(endedAt) - Date.parse(session.startedAt)) / 1000),
  );
  const linkedIncidentId = linkedIncidentIdForSession(session);
  const assistMonth = endedAt.slice(0, 7);
  return {
    assistanceId: `assist_${session.sessionId}`,
    agencyId: session.agencyId,
    sessionId: session.sessionId,
    vertical: session.vertical ?? "law_enforcement",
    officerId: session.officerId,
    officerName: session.officerName,
    subjectLanguage: session.subjectLanguage,
    primaryLanguage: session.primaryLanguage,
    startedAt: session.startedAt,
    endedAt,
    durationSec,
    segmentCount: session.segmentCount,
    linkedIncidentId,
    standalone: !linkedIncidentId,
    assistMonth,
    createdAt: now,
  };
}

export async function persistTranslateAssistanceEncounter(
  session: TranslateSession,
): Promise<TranslateAssistanceEncounter> {
  const row = buildAssistanceEncounter(session);
  await translateStore.putAssistanceEncounter(row);
  return row;
}

async function postInternalNote(url: string, body: unknown): Promise<boolean> {
  if (!env.internalApiKey) return false;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-internal-key": env.internalApiKey,
    },
    body: JSON.stringify(body),
  });
  return res.ok;
}

export async function queueVerticalWriteback(opts: {
  session: TranslateSession;
  summary: string;
  segments: TranslateSegment[];
  actorId: string;
  /** When true, only persist the assistance encounter (no incident/hospital note). */
  skipIncidentNote?: boolean;
}): Promise<{
  queued: boolean;
  cadQueued: boolean;
  noteId?: string;
  assistanceId?: string;
}> {
  const vertical = opts.session.vertical ?? "law_enforcement";
  const assistance = await persistTranslateAssistanceEncounter(opts.session);

  if (opts.skipIncidentNote || !hasWritebackTarget(opts.session, vertical)) {
    return {
      queued: true,
      cadQueued: false,
      assistanceId: assistance.assistanceId,
    };
  }

  const endedAt = opts.session.endedAt ?? new Date().toISOString();
  const duration = formatDuration(opts.session.startedAt, endedAt);
  const noteId = makeId("tnote");
  let cadQueued = false;
  let queued = false;

  if (vertical === "law_enforcement") {
    if (!env.cadWritebackEnabled) {
      return {
        queued: true,
        cadQueued: false,
        assistanceId: assistance.assistanceId,
      };
    }
    cadQueued = true;
    queued = true;
    await translateStore.putSession({
      ...opts.session,
      cadWritebackStatus: "PENDING",
      cadNoteId: noteId,
      updatedAt: new Date().toISOString(),
    });
  } else if (vertical === "venue") {
    const ctx = opts.session.venueContext;
    const base = env.venueApiUrl.replace(/\/$/, "");
    const url = ctx && base
      ? `${base}/api/venue/incidents/${encodeURIComponent(ctx.venueIncidentId ?? "")}/notes`
      : "";
    const ok =
      url &&
      (await postInternalNote(url, {
        type: "translate_session",
        content: opts.summary,
        metadata: {
          sessionId: opts.session.sessionId,
          venueCode: ctx?.venueCode,
          duration,
          segmentCount: opts.session.segmentCount,
        },
      }));
    queued = true;
    await translateStore.putSession({
      ...opts.session,
      cadWritebackStatus: ok ? "AUTO" : "PENDING",
      cadNoteId: noteId,
      updatedAt: new Date().toISOString(),
    });
  } else if (vertical === "campus") {
    const ctx = opts.session.campusContext;
    const base = env.campusApiUrl.replace(/\/$/, "");
    const url = ctx && base
      ? `${base}/api/campus/incidents/${encodeURIComponent(ctx.campusIncidentId ?? "")}/notes`
      : "";
    const ok =
      url &&
      (await postInternalNote(url, {
        type: "translate_session",
        content: opts.summary,
        metadata: {
          sessionId: opts.session.sessionId,
          campusCode: ctx?.campusCode,
          duration,
          segmentCount: opts.session.segmentCount,
        },
      }));
    queued = true;
    await translateStore.putSession({
      ...opts.session,
      cadWritebackStatus: ok ? "AUTO" : "PENDING",
      cadNoteId: noteId,
      updatedAt: new Date().toISOString(),
    });
  } else {
    const ctx = opts.session.hospitalContext;
    const base = env.hospitalApiUrl.replace(/\/$/, "");
    const url = ctx && base
      ? `${base}/api/encounters/${encodeURIComponent(ctx.patientEncounterId ?? "")}/notes`
      : "";
    const transcriptKey = env.translateAudioBucket
      ? `s3://${env.translateAudioBucket}/audio/hospital/${opts.session.agencyId}/${opts.session.sessionId}/transcript.txt`
      : undefined;
    const ok =
      url &&
      (await postInternalNote(url, {
        type: "translate_session",
        content: opts.summary,
        transcriptReference: transcriptKey,
        metadata: {
          sessionId: opts.session.sessionId,
          language: opts.session.subjectLanguage,
          duration,
        },
      }));
    queued = true;
    await translateStore.putSession({
      ...opts.session,
      cadWritebackStatus: ok ? "AUTO" : "PENDING",
      cadNoteId: noteId,
      updatedAt: new Date().toISOString(),
    });
  }

  await audit.create({
    eventId: makeId("audit"),
    agencyId: opts.session.agencyId,
    actorId: opts.actorId,
    type: AUDIT_EVENT_TYPES.TRANSLATE_WRITEBACK_QUEUED,
    details: {
      sessionId: opts.session.sessionId,
      vertical,
      cadQueued,
      noteId,
      incidentId: opts.session.incidentId,
      assistanceId: assistance.assistanceId,
      transcriptChars: formatTranscript(opts.session, opts.segments).length,
    },
    createdAt: new Date().toISOString(),
    resourceType: "session",
    resourceId: opts.session.sessionId,
  });

  return { queued, cadQueued, noteId, assistanceId: assistance.assistanceId };
}
