import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import {
  getProtocolPackById,
  listProtocolPacks,
  type AgencyTenant,
  type ProtocolPack,
  type SopProtocolOverlayState,
  type UserContext,
} from "rapid-cortex-shared";
import { AUDIT_EVENT_TYPES } from "rapid-cortex-security";
import { IncidentRepository } from "../repositories/incidentRepository.js";
import { AgencyRepository } from "../repositories/agencyRepository.js";
import { TranscriptRepository } from "../repositories/transcriptRepository.js";
import { AuditRepository } from "../repositories/auditRepository.js";
import { makeId } from "../lib/ids.js";
import { env } from "../lib/env.js";

const incidents = new IncidentRepository();
const agencies = new AgencyRepository();
const transcripts = new TranscriptRepository();
const auditRepo = new AuditRepository();
const s3 = new S3Client({ region: env.region });

function normalizeText(s: string): string {
  return s.toLowerCase().replace(/\s+/g, " ").trim();
}

function scorePack(pack: ProtocolPack, haystack: string, sopHaystack: string): number {
  let score = 0;
  for (const kw of pack.identificationKeywords) {
    const k = normalizeText(kw);
    if (k.length < 2) continue;
    if (haystack.includes(k)) score += 2;
    if (sopHaystack.length > 0 && sopHaystack.includes(k)) score += 1;
  }
  return score;
}

function pickBestPack(
  packs: readonly ProtocolPack[],
  haystack: string,
  sopHaystack: string,
): { pack: ProtocolPack | null; confidence: number; label: string } {
  let best: ProtocolPack | null = null;
  let bestScore = 0;
  for (const pack of packs) {
    const s = scorePack(pack, haystack, sopHaystack);
    if (s > bestScore) {
      bestScore = s;
      best = pack;
    }
  }
  if (!best) {
    return { pack: null, confidence: 0.15, label: "Unknown" };
  }
  const confidence = Math.min(0.97, 0.35 + bestScore * 0.08);
  return { pack: best, confidence, label: best.name };
}

async function loadSopText(agencyId: string, key?: string): Promise<string> {
  if (!key?.trim()) return "";
  try {
    const res = await s3.send(
      new GetObjectCommand({
        Bucket: env.assetsBucket,
        Key: key.trim(),
      }),
    );
    const body = await res.Body?.transformToString();
    return normalizeText(body ?? "");
  } catch {
    return "";
  }
}

export class SopService {
  async runDetectionAndPersist(
    incidentId: string,
    user: UserContext,
    opts: { manual?: boolean } = {},
  ): Promise<SopProtocolOverlayState | null> {
    if (!env.enableSopProtocolAi) return null;

    const incident = await incidents.get(incidentId);
    if (!incident || incident.agencyId !== user.agencyId) return null;

    const overlay = incident.sopProtocolOverlay ?? null;
    if (!opts.manual && overlay?.dismissedAt) {
      return overlay;
    }

    const agency = await agencies.get(user.agencyId);
    if (!agency?.config.sop?.autoDetectEnabled && !opts.manual) {
      return overlay;
    }

    const segs = await transcripts.listByIncident(incidentId);
    const tail = segs.slice(-40);
    const haystack = normalizeText(tail.map((s) => s.text).join(" \n "));
    const sopKey = agency?.config.sop?.sopDocumentS3Key;
    const sopHaystack = await loadSopText(user.agencyId, sopKey);

    let state: SopProtocolOverlayState;
    const dismissedAt = opts.manual ? null : (overlay?.dismissedAt ?? null);
    if (env.sopDetectionMock) {
      const p = getProtocolPackById("default.welfare_check_v1") ?? listProtocolPacks()[0] ?? null;
      state = {
        recommendedProtocolPackId: p?.id ?? null,
        incidentTypeLabel: p?.name ?? "Mock protocol",
        confidence: 0.82,
        dismissedAt,
        manualProtocolPackId: overlay?.manualProtocolPackId ?? null,
        completedStepIds: overlay?.completedStepIds ?? [],
        segmentCountAtDetection: segs.length,
        detectedAt: new Date().toISOString(),
      };
    } else {
      const packs = listProtocolPacks().filter(
        (pk) => !pk.agencyIds?.length || pk.agencyIds.includes(user.agencyId),
      );
      const { pack, confidence, label } = pickBestPack(packs, haystack, sopHaystack);
      state = {
        recommendedProtocolPackId: pack?.id ?? null,
        incidentTypeLabel: label,
        confidence,
        dismissedAt,
        manualProtocolPackId: overlay?.manualProtocolPackId ?? null,
        completedStepIds: overlay?.completedStepIds ?? [],
        segmentCountAtDetection: segs.length,
        detectedAt: new Date().toISOString(),
      };
    }

    await incidents.updateSopProtocolOverlay(incidentId, state);
    await auditRepo.create({
      eventId: makeId("audit"),
      agencyId: user.agencyId,
      incidentId,
      actorId: user.userId,
      type: AUDIT_EVENT_TYPES.SOP_PROTOCOL_DETECTED,
      details: {
        manual: Boolean(opts.manual),
        recommendedProtocolPackId: state.recommendedProtocolPackId,
        confidence: state.confidence,
        segmentCount: state.segmentCountAtDetection,
      },
      createdAt: new Date().toISOString(),
      resourceType: "incident",
      resourceId: incidentId,
    });
    return state;
  }

  /** Resolve active pack id (manual override wins when set). */
  resolveActivePackId(agency: AgencyTenant | null, overlay: SopProtocolOverlayState | null | undefined): string | null {
    if (overlay?.manualProtocolPackId) return overlay.manualProtocolPackId;
    if (overlay?.recommendedProtocolPackId) return overlay.recommendedProtocolPackId;
    return agency?.config.protocolPackId ?? null;
  }
}
