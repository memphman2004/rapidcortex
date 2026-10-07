import type { Incident, SurgeClusterDetail, SurgeClusterSummary, UserContext } from "rapid-cortex-shared";
import {
  SURGE_CONFIG,
  extractKeywords,
  calculateKeywordSimilarity,
  surgeSplitClusterBodySchema,
} from "rapid-cortex-shared";
import { AUDIT_EVENT_TYPES, TenantAccessGuard } from "rapid-cortex-security";
import { env } from "../lib/env.js";
import { makeId } from "../lib/ids.js";
import { haversineMiles } from "../lib/distance-calculations.js";
import { resolveIncidentRead } from "../lib/incidentReadAccess.js";
import { AuditRepository } from "../repositories/auditRepository.js";
import { IncidentRepository } from "../repositories/incidentRepository.js";
import { TranscriptRepository } from "../repositories/transcriptRepository.js";
import {
  SurgeClusterRepository,
  type SurgeClusterDdbItem,
  type SurgeMembershipDdbItem,
} from "../repositories/surgeClusterRepository.js";
import { UnionFind } from "./surge/surge-clustering.js";
import { extractUniqueDetails } from "./surge/unique-detail-extractor.js";
import { buildClusterSummary } from "./surge/cluster-summary-generator.js";

const incidentRepo = new IncidentRepository();
const transcriptRepo = new TranscriptRepository();
const surgeRepo = new SurgeClusterRepository();
const auditRepo = new AuditRepository();

function assertSurgeEnabled(): void {
  if (!env.enableSurge) throw new Error("SURGE_DISABLED");
  if (!env.surgeClustersTable) throw new Error("SURGE_CLUSTERS_TABLE_NOT_CONFIGURED");
}

function incidentCoords(inc: Incident): { lat: number; lng: number } | null {
  if (inc.callerLocationLat != null && inc.callerLocationLng != null) {
    return { lat: inc.callerLocationLat, lng: inc.callerLocationLng };
  }
  if (inc.cadCoordinates?.lat != null && inc.cadCoordinates?.lng != null) {
    return { lat: inc.cadCoordinates.lat, lng: inc.cadCoordinates.lng };
  }
  return null;
}

function activeEnough(status: Incident["status"]): boolean {
  return status === "active" || status === "in_progress";
}

export class SurgeService {
  async analyze(incidentId: string, user: UserContext): Promise<{ clustersCreated: number }> {
    assertSurgeEnabled();
    const resolved = await resolveIncidentRead(incidentId, user);
    if (!resolved) throw new Error("NOT_FOUND");
    TenantAccessGuard.assertIncidentAccess(resolved.incident, user);
    const agencyId = resolved.incident.agencyId;
    const windowMs = SURGE_CONFIG.MAX_TIME_WINDOW_MINUTES * 60 * 1000;
    const sinceIso = new Date(Date.now() - windowMs).toISOString();
    const candidates = (await incidentRepo.listByAgencySince(agencyId, sinceIso, 200)).filter((i) =>
      activeEnough(i.status),
    );
    if (candidates.length < SURGE_CONFIG.MIN_CLUSTER_SIZE) {
      await auditRepo.create({
        eventId: makeId("aud"),
        agencyId,
        incidentId,
        actorId: user.userId,
        type: AUDIT_EVENT_TYPES.SURGE_CALL_ANALYZED,
        details: { incidentIds: candidates.map((c) => c.incidentId), clustersCreated: 0 },
        createdAt: new Date().toISOString(),
        resourceType: "incident",
        resourceId: incidentId,
      });
      return { clustersCreated: 0 };
    }

    const texts: Record<string, string> = {};
    const keywords: Record<string, string[]> = {};
    for (const inc of candidates) {
      const segs = await transcriptRepo.listByIncident(inc.incidentId);
      const slice = segs.slice(0, 80);
      const t = slice
        .map((s) => s.text)
        .join(" ")
        .slice(0, 8000);
      texts[inc.incidentId] = t;
      keywords[inc.incidentId] = extractKeywords(t);
    }

    const uf = new UnionFind();
    const ids = candidates.map((c) => c.incidentId);
    for (const id of ids) uf.find(id);

    for (let i = 0; i < candidates.length; i++) {
      for (let j = i + 1; j < candidates.length; j++) {
        const a = candidates[i]!;
        const b = candidates[j]!;
        const ka = keywords[a.incidentId] ?? [];
        const kb = keywords[b.incidentId] ?? [];
        const setA = new Set(ka.map((k) => k.toLowerCase()));
        const setB = new Set(kb.map((k) => k.toLowerCase()));
        let inter = 0;
        for (const x of setA) if (setB.has(x)) inter += 1;
        if (inter < SURGE_CONFIG.MIN_KEYWORD_MATCHES) continue;
        const sim = calculateKeywordSimilarity(ka, kb);
        if (sim < SURGE_CONFIG.MIN_CONFIDENCE * 0.5) continue;
        const ta = Date.parse(a.createdAt);
        const tb = Date.parse(b.createdAt);
        if (Math.abs(ta - tb) > windowMs) continue;
        const ca = incidentCoords(a);
        const cb = incidentCoords(b);
        if (ca && cb) {
          const mi = haversineMiles(ca.lat, ca.lng, cb.lat, cb.lng);
          if (mi > SURGE_CONFIG.MAX_DISTANCE_MILES) continue;
        }
        uf.union(a.incidentId, b.incidentId);
      }
    }

    const groups = uf
      .groups(ids)
      .filter((g) => g.length >= SURGE_CONFIG.MIN_CLUSTER_SIZE && g.length <= SURGE_CONFIG.MAX_CLUSTER_SIZE);
    const now = new Date().toISOString();
    const ttl = Math.floor(Date.now() / 1000) + SURGE_CONFIG.CLUSTER_TTL_HOURS * 3600;
    let created = 0;

    for (const group of groups) {
      const clusterId = makeId("srg");
      const perIncidentKeywords: Record<string, string[]> = {};
      for (const id of group) perIncidentKeywords[id] = keywords[id] ?? [];
      const flat = group.flatMap((id) => perIncidentKeywords[id] ?? []);
      const freq = new Map<string, number>();
      for (const k of flat) {
        const kk = k.toLowerCase();
        freq.set(kk, (freq.get(kk) ?? 0) + 1);
      }
      const headlineKeywords = [...freq.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 12)
        .map(([k]) => k);
      const uniqueDetails = extractUniqueDetails(perIncidentKeywords);
      const anchor = candidates.find((c) => c.incidentId === incidentId) ?? candidates.find((c) => group.includes(c.incidentId));
      const summary = buildClusterSummary({
        incidentIds: group,
        headlineKeywords,
        windowMinutes: SURGE_CONFIG.MAX_TIME_WINDOW_MINUTES,
        anchorIncident: anchor ?? null,
      });
      const confidence = Math.min(
        1,
        headlineKeywords.length > 0 ? SURGE_CONFIG.MIN_CONFIDENCE + 0.15 : SURGE_CONFIG.MIN_CONFIDENCE,
      );

      const cluster: SurgeClusterDdbItem = {
        entityType: "cluster",
        pk: `AGENCY#${agencyId}`,
        sk: `CLUSTER#${clusterId}`,
        agencyId,
        clusterId,
        incidentIds: group,
        status: "pending",
        confidence,
        headlineKeywords,
        perIncidentKeywords,
        summary,
        uniqueDetails,
        createdAt: now,
        updatedAt: now,
        ttl,
      };
      const memberships: SurgeMembershipDdbItem[] = group.map((iid) => ({
        entityType: "membership",
        pk: `INCIDENT#${agencyId}#${iid}`,
        sk: `CLUSTER#${clusterId}`,
        agencyId,
        incidentId: iid,
        clusterId,
        status: "pending",
        updatedAt: now,
        ttl,
      }));
      await surgeRepo.putClusterWithMemberships(cluster, memberships);
      created += 1;

      await auditRepo.create({
        eventId: makeId("aud"),
        agencyId,
        incidentId,
        actorId: user.userId,
        type: AUDIT_EVENT_TYPES.SURGE_CLUSTER_DETECTED,
        details: { clusterId, incidentIds: group },
        createdAt: now,
        resourceType: "incident",
        resourceId: clusterId,
      });
    }

    await auditRepo.create({
      eventId: makeId("aud"),
      agencyId,
      incidentId,
      actorId: user.userId,
      type: AUDIT_EVENT_TYPES.SURGE_CALL_ANALYZED,
      details: { clustersCreated: created, candidateCount: candidates.length },
      createdAt: new Date().toISOString(),
      resourceType: "incident",
      resourceId: incidentId,
    });

    return { clustersCreated: created };
  }

  async listClusters(incidentId: string, user: UserContext): Promise<{ items: SurgeClusterSummary[] }> {
    assertSurgeEnabled();
    const resolved = await resolveIncidentRead(incidentId, user);
    if (!resolved) throw new Error("NOT_FOUND");
    TenantAccessGuard.assertIncidentAccess(resolved.incident, user);
    const mems = await surgeRepo.listMembershipsForIncident(resolved.incident.agencyId, incidentId);
    const summaries: SurgeClusterSummary[] = [];
    const seen = new Set<string>();
    for (const m of mems) {
      if (seen.has(m.clusterId)) continue;
      const row = await surgeRepo.getCluster(resolved.incident.agencyId, m.clusterId);
      if (!row || row.status === "dismissed") continue;
      seen.add(m.clusterId);
      summaries.push({
        clusterId: row.clusterId,
        status: row.status,
        incidentCount: row.incidentIds.length,
        confidence: row.confidence,
        headlineKeywords: row.headlineKeywords,
        updatedAt: row.updatedAt,
        createdAt: row.createdAt,
      });
    }
    return { items: summaries.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1)) };
  }

  async getClusterDetail(incidentId: string, clusterId: string, user: UserContext): Promise<SurgeClusterDetail> {
    assertSurgeEnabled();
    const resolved = await resolveIncidentRead(incidentId, user);
    if (!resolved) throw new Error("NOT_FOUND");
    TenantAccessGuard.assertIncidentAccess(resolved.incident, user);
    const row = await surgeRepo.getCluster(resolved.incident.agencyId, clusterId);
    if (!row || !row.incidentIds.includes(incidentId)) throw new Error("NOT_FOUND");
    return surgeRepo.toDetail(row);
  }

  async confirmCluster(incidentId: string, clusterId: string, user: UserContext): Promise<SurgeClusterDetail> {
    return this.setClusterStatus(incidentId, clusterId, user, "confirmed", AUDIT_EVENT_TYPES.SURGE_CLUSTER_CONFIRMED);
  }

  async dismissCluster(incidentId: string, clusterId: string, user: UserContext): Promise<SurgeClusterDetail> {
    return this.setClusterStatus(incidentId, clusterId, user, "dismissed", AUDIT_EVENT_TYPES.SURGE_CLUSTER_DISMISSED);
  }

  private async setClusterStatus(
    incidentId: string,
    clusterId: string,
    user: UserContext,
    status: SurgeClusterDdbItem["status"],
    auditType: string,
  ): Promise<SurgeClusterDetail> {
    assertSurgeEnabled();
    const resolved = await resolveIncidentRead(incidentId, user);
    if (!resolved) throw new Error("NOT_FOUND");
    TenantAccessGuard.assertIncidentAccess(resolved.incident, user);
    const row = await surgeRepo.getCluster(resolved.incident.agencyId, clusterId);
    if (!row || !row.incidentIds.includes(incidentId)) throw new Error("NOT_FOUND");
    const now = new Date().toISOString();
    const updated: SurgeClusterDdbItem = { ...row, status, updatedAt: now };
    await surgeRepo.putClusterWithMemberships(
      updated,
      row.incidentIds.map((iid) => ({
        entityType: "membership",
        pk: `INCIDENT#${row.agencyId}#${iid}`,
        sk: `CLUSTER#${clusterId}`,
        agencyId: row.agencyId,
        incidentId: iid,
        clusterId,
        status,
        updatedAt: now,
        ttl: row.ttl,
      })),
    );
    await auditRepo.create({
      eventId: makeId("aud"),
      agencyId: row.agencyId,
      incidentId,
      actorId: user.userId,
      type: auditType,
      details: { clusterId, status },
      createdAt: now,
      resourceType: "incident",
      resourceId: clusterId,
    });
    return surgeRepo.toDetail(updated);
  }

  async splitCluster(incidentId: string, clusterId: string, user: UserContext, rawBody: unknown): Promise<SurgeClusterDetail> {
    assertSurgeEnabled();
    const body = surgeSplitClusterBodySchema.parse(rawBody);
    const resolved = await resolveIncidentRead(incidentId, user);
    if (!resolved) throw new Error("NOT_FOUND");
    TenantAccessGuard.assertIncidentAccess(resolved.incident, user);
    const row = await surgeRepo.getCluster(resolved.incident.agencyId, clusterId);
    if (!row || !row.incidentIds.includes(incidentId)) throw new Error("NOT_FOUND");
    const remove = new Set(body.incidentIdsToRemove);
    for (const id of body.incidentIdsToRemove) {
      if (!row.incidentIds.includes(id)) throw new Error("VALIDATION:incident not in cluster");
    }
    const remaining = row.incidentIds.filter((id) => !remove.has(id));
    const now = new Date().toISOString();
    const pairs = body.incidentIdsToRemove.map((iid: string) => ({ incidentId: iid, clusterId }));
    await surgeRepo.deleteMemberships(row.agencyId, pairs);

    if (remaining.length < SURGE_CONFIG.MIN_CLUSTER_SIZE) {
      await surgeRepo.deleteClusterRow(row.agencyId, clusterId);
      await auditRepo.create({
        eventId: makeId("aud"),
        agencyId: row.agencyId,
        incidentId,
        actorId: user.userId,
        type: AUDIT_EVENT_TYPES.SURGE_CLUSTER_DISMISSED,
        details: { clusterId, reason: "split_below_min" },
        createdAt: now,
        resourceType: "incident",
        resourceId: clusterId,
      });
      throw new Error("CLUSTER_COLLAPSED");
    }

    const updated: SurgeClusterDdbItem = {
      ...row,
      incidentIds: remaining,
      updatedAt: now,
      uniqueDetails: extractUniqueDetails(
        Object.fromEntries(remaining.map((id) => [id, row.perIncidentKeywords[id] ?? []])),
      ),
      summary: buildClusterSummary({
        incidentIds: remaining,
        headlineKeywords: row.headlineKeywords,
        windowMinutes: SURGE_CONFIG.MAX_TIME_WINDOW_MINUTES,
        anchorIncident: resolved.incident,
      }),
    };
    const memberships: SurgeMembershipDdbItem[] = remaining.map((iid) => ({
      entityType: "membership",
      pk: `INCIDENT#${row.agencyId}#${iid}`,
      sk: `CLUSTER#${clusterId}`,
      agencyId: row.agencyId,
      incidentId: iid,
      clusterId,
      status: row.status,
      updatedAt: now,
      ttl: row.ttl,
    }));
    await surgeRepo.putClusterWithMemberships(updated, memberships);

    await auditRepo.create({
      eventId: makeId("aud"),
      agencyId: row.agencyId,
      incidentId,
      actorId: user.userId,
      type: AUDIT_EVENT_TYPES.SURGE_CLUSTER_SPLIT,
      details: { clusterId, removed: [...remove] },
      createdAt: now,
      resourceType: "incident",
      resourceId: clusterId,
    });
    return surgeRepo.toDetail(updated);
  }
}
