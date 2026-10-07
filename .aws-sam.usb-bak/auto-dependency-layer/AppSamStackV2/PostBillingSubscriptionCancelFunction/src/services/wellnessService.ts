import { normalizeAddressForIndex, type TranscriptSegment, type TraumaFlagRecord, type UserContext } from "rapid-cortex-shared";
import { WellnessRepository } from "../repositories/wellnessRepository.js";
import { IncidentRepository } from "../repositories/incidentRepository.js";
import { AgencyRepository } from "../repositories/agencyRepository.js";
import { AuditRepository } from "../repositories/auditRepository.js";
import { makeId } from "../lib/ids.js";
import { AUDIT_EVENT_TYPES } from "rapid-cortex-security";
import { env } from "../lib/env.js";

const repo = new WellnessRepository();
const incidents = new IncidentRepository();
const agencies = new AgencyRepository();
const auditRepo = new AuditRepository();

const DEFAULT_KEYWORDS = [
  "i can't do this",
  "i cant do this",
  "this is too much",
  "i need a break",
  "shaking",
  "panic attack",
];

function norm(s: string): string {
  return s.toLowerCase().replace(/\s+/g, " ").trim();
}

export class WellnessService {
  async scanNewSegment(segment: TranscriptSegment, user: UserContext): Promise<void> {
    if (!env.enableDispatcherWellness || !env.traumaFlagsTable) return;
    const incident = await incidents.get(segment.incidentId);
    if (!incident || incident.agencyId !== user.agencyId) return;

    const tenant = await agencies.get(user.agencyId);
    if (!tenant?.config.wellness?.enabled) return;

    const keywords = tenant.config.wellness.keywords?.length
      ? tenant.config.wellness.keywords
      : DEFAULT_KEYWORDS;
    const hay = norm(segment.text);
    const matched = keywords.filter((k) => hay.includes(norm(k)));
    if (!matched.length) return;

    const since = new Date(Date.now() - 3_600_000).toISOString();
    const recent = await repo.listOpenByIncidentSince(segment.incidentId, since);
    if (recent.some((r) => matched.some((m) => r.matchedKeywords.includes(m)))) {
      return;
    }

    const now = new Date().toISOString();
    const callerNorm =
      incident.callerAddressNormalized?.trim() ||
      (incident.callerAddressLine ? normalizeAddressForIndex(incident.callerAddressLine) : "");
    const row: TraumaFlagRecord = {
      flagId: makeId("trau"),
      agencyId: user.agencyId,
      incidentId: segment.incidentId,
      dispatcherUserId: user.userId,
      status: "open",
      matchedKeywords: matched,
      excerpt: segment.text.slice(0, 500),
      createdAt: now,
      ...(callerNorm.length > 0
        ? { agencyCallerAddressKey: `${incident.agencyId}#${callerNorm}` }
        : {}),
    };
    await repo.create(row);
    await auditRepo.create({
      eventId: makeId("audit"),
      agencyId: user.agencyId,
      incidentId: segment.incidentId,
      actorId: user.userId,
      type: AUDIT_EVENT_TYPES.WELLNESS_TRAUMA_FLAG_CREATED,
      details: { flagId: row.flagId, matched },
      createdAt: now,
      resourceType: "incident",
      resourceId: segment.incidentId,
    });
  }

  async listFlags(user: UserContext): Promise<TraumaFlagRecord[]> {
    if (!env.enableDispatcherWellness || !env.traumaFlagsTable) {
      throw new Error("WELLNESS_DISABLED");
    }
    return repo.listByAgency(user.agencyId, 100);
  }

  async acknowledge(flagId: string, user: UserContext): Promise<void> {
    if (!env.enableDispatcherWellness || !env.traumaFlagsTable) {
      throw new Error("WELLNESS_DISABLED");
    }
    await repo.acknowledge(flagId, user.agencyId, user.userId);
    const now = new Date().toISOString();
    await auditRepo.create({
      eventId: makeId("audit"),
      agencyId: user.agencyId,
      actorId: user.userId,
      type: AUDIT_EVENT_TYPES.WELLNESS_TRAUMA_FLAG_ACK,
      details: { flagId },
      createdAt: now,
      resourceType: "unknown",
      resourceId: flagId,
    });
  }
}
