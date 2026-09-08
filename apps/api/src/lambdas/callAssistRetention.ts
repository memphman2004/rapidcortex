import type { Handler } from "aws-lambda";
import { AUDIT_EVENT_TYPES } from "rapid-cortex-security";
import { planCallAssistRetentionActions } from "rapid-cortex-shared";
import { env } from "../lib/env.js";
import { makeId } from "../lib/ids.js";
import { AuditRepository } from "../repositories/auditRepository.js";
import { callAssistStore } from "../call-assist/store.js";

const auditRepo = new AuditRepository();
const ACTOR = "system:call-assist-retention";

export async function processCallAssistRetentionPass(): Promise<{
  sessions: number;
  transcriptsRedacted: number;
  audioRedacted: number;
  surveysDeleted: number;
  skippedLegalHold: number;
  errors: string[];
}> {
  if (!env.callAssistTable) {
    return {
      sessions: 0,
      transcriptsRedacted: 0,
      audioRedacted: 0,
      surveysDeleted: 0,
      skippedLegalHold: 0,
      errors: ["CALL_ASSIST_TABLE unset"],
    };
  }
  const errors: string[] = [];
  let sessions = 0;
  let transcriptsRedacted = 0;
  let audioRedacted = 0;
  let surveysDeleted = 0;
  let skippedLegalHold = 0;
  const configs = await callAssistStore.listTenantConfigs(500);
  for (const cfg of configs) {
    const done = await callAssistStore.listSessions(cfg.agencyId, false, 200);
    const policy = cfg.retention;
    let agencySessions = 0;
    let agencyTranscripts = 0;
    let agencyAudio = 0;
    let agencySurveys = 0;
    let agencyHold = 0;
    for (const session of done) {
      if (session.agencyId !== cfg.agencyId) continue;
      const plan = planCallAssistRetentionActions({
        createdAtIso: session.createdAt,
        policy,
        legalHold: Boolean(session.legalHold),
      });
      if (session.legalHold) {
        skippedLegalHold += 1;
        agencyHold += 1;
        continue;
      }
      try {
        if (plan.deleteSurvey) {
          await callAssistStore.deleteSurvey(session.agencyId, session.sessionId);
          surveysDeleted += 1;
          agencySurveys += 1;
        }
        if (plan.deleteSession) {
          const okDel = await callAssistStore.deleteSessionIfNotOnLegalHold(session.agencyId, session.sessionId);
          if (!okDel) {
            skippedLegalHold += 1;
            agencyHold += 1;
            continue;
          }
          await auditRepo.create({
            eventId: makeId("audit"),
            agencyId: session.agencyId,
            actorId: ACTOR,
            type: AUDIT_EVENT_TYPES.RETENTION_RECORD_PURGED,
            details: {
              resourceType: "call_assist_session",
              sessionId: session.sessionId,
              dataTypes: ["intake", "transcript", "audio", "analytics"],
            },
            createdAt: new Date().toISOString(),
            resourceType: "session",
            resourceId: session.sessionId,
          });
          sessions += 1;
          agencySessions += 1;
          continue;
        }
        let changed = false;
        if (plan.redactTranscript && !session.transcriptPurgedAt) {
          session.utterances = [];
          session.transcriptPurgedAt = new Date().toISOString();
          transcriptsRedacted += 1;
          agencyTranscripts += 1;
          changed = true;
        }
        if (plan.redactAudio && !session.audioPurgedAt) {
          session.audioPurgedAt = new Date().toISOString();
          audioRedacted += 1;
          agencyAudio += 1;
          changed = true;
        }
        if (changed) {
          session.updatedAt = new Date().toISOString();
          await callAssistStore.putSession(session);
        }
      } catch (e) {
        errors.push(`${session.sessionId}:${String(e)}`);
      }
    }
    cfg.retentionLastRun = {
      at: new Date().toISOString(),
      sessionsDeleted: agencySessions,
      transcriptsRedacted: agencyTranscripts,
      audioRedacted: agencyAudio,
      surveysDeleted: agencySurveys,
      skippedLegalHold: agencyHold,
    };
    cfg.updatedAt = cfg.retentionLastRun.at;
    await callAssistStore.putConfig(cfg);
  }
  return { sessions, transcriptsRedacted, audioRedacted, surveysDeleted, skippedLegalHold, errors };
}

export const handler: Handler = async () => {
  const out = await processCallAssistRetentionPass();
  console.log(JSON.stringify({ type: "call_assist.retention.complete", ...out }));
};
