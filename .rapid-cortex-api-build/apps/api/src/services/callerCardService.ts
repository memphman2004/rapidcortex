import { MockCadAdapter } from "rapid-cortex-integrations";
import {
  normalizeAddressForIndex,
  type CadDataStatus,
  type CallerCardCadData,
  type CallerCardLocation,
  type CreatePremiseNoteRequest,
  type CreatePremiseNoteResponse,
  type GetCallerCardResponse,
  type PatchPremiseNoteRequest,
  type PatchPremiseNoteResponse,
  type UserContext,
  type Incident,
} from "rapid-cortex-shared";
import { resolveIncidentRead } from "../lib/incidentReadAccess.js";
import { env } from "../lib/env.js";
import { makeId } from "../lib/ids.js";
import { IncidentRepository } from "../repositories/incidentRepository.js";
import { PremiseNotesRepository } from "../repositories/premiseNotesRepository.js";
import { WellnessRepository } from "../repositories/wellnessRepository.js";

const cad = new MockCadAdapter();
const incidentRepo = new IncidentRepository();
const premiseRepo = new PremiseNotesRepository();
const wellnessRepo = new WellnessRepository();

const PRIOR_INCIDENT_WINDOW_MS = 365 * 24 * 60 * 60 * 1000;
const MAX_PRIOR_COLLECT = 150;
const MAX_PRIOR_RETURN = 50;
const DISPLAY_PRIOR_CAP = 10;

function toStr(v: unknown): string | undefined {
  if (v == null) return undefined;
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  return undefined;
}

function toStrList(v: unknown): string[] | undefined {
  if (v == null) return undefined;
  if (Array.isArray(v)) {
    return v.map((x) => String(x)).filter(Boolean);
  }
  return undefined;
}

function formatRelativeTimeShort(iso: string): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "—";
  const diff = Date.now() - t;
  const m = Math.floor(diff / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 48) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 14) return `${d}d ago`;
  const w = Math.floor(d / 7);
  if (w < 8) return `${w}w ago`;
  const mo = Math.floor(d / 30);
  return mo < 12 ? `${mo}mo ago` : `${Math.floor(d / 365)}y ago`;
}

function buildCadData(raw: Record<string, unknown> | null, fetchFailed: boolean): CallerCardCadData {
  if (fetchFailed) {
    return {
      status: "unavailable",
      source: "cad",
    };
  }
  if (!raw || Object.keys(raw).length === 0) {
    return { status: "unavailable", source: "cad" };
  }
  const statusField = toStr(raw.cadStatus) ?? toStr(raw.status);
  let status: CadDataStatus = "mock";
  if (statusField === "live") status = "live";
  else if (statusField === "unavailable" || raw.unavailable === true) status = "unavailable";
  else if (raw.mock === true || statusField === "mock") status = "mock";

  const deviceData =
    raw.deviceData && typeof raw.deviceData === "object" && !Array.isArray(raw.deviceData)
      ? (raw.deviceData as Record<string, unknown>)
      : undefined;

  return {
    callerName: toStr(raw.callerName) ?? toStr(raw.subscriberName),
    callbackPhone: toStr(raw.callbackPhone) ?? toStr(raw.callerNumber),
    emergencyContacts: toStrList(raw.emergencyContacts),
    premiseWarnings: toStrList(raw.premiseWarnings) ?? toStrList(raw.warnings),
    deviceData,
    status,
    source: "cad",
  };
}

function buildLocation(incident: Incident, cadHint: { mapLabel?: string } | null): CallerCardLocation {
  const line = incident.callerAddressLine?.trim();
  const hasCoords =
    typeof incident.callerLocationLat === "number" &&
    typeof incident.callerLocationLng === "number" &&
    !Number.isNaN(incident.callerLocationLat) &&
    !Number.isNaN(incident.callerLocationLng);

  if (line) {
    return {
      address: line,
      ...(hasCoords
        ? { latitude: incident.callerLocationLat!, longitude: incident.callerLocationLng! }
        : {}),
      ...(incident.callerLocationMapLabel
        ? { mapLabel: incident.callerLocationMapLabel }
        : hasCoords
          ? { mapLabel: "From incident" }
          : {}),
      source: "incident",
    };
  }
  if (cadHint?.mapLabel) {
    return {
      address: cadHint.mapLabel,
      source: "cad",
    };
  }
  return { address: "Address not set for this incident", source: "incident" };
}

export class CallerCardService {
  async get(incidentId: string, user: UserContext): Promise<GetCallerCardResponse | null> {
    if (!env.enableCallerCard) return null;
    const resolved = await resolveIncidentRead(incidentId, user);
    if (!resolved || resolved.kind === "shared") return null;
    const { incident } = resolved;

    const normalized =
      incident.callerAddressNormalized?.trim() ||
      (incident.callerAddressLine ? normalizeAddressForIndex(incident.callerAddressLine) : "");
    const normalizedAddress = normalized.length > 0 ? normalized : null;

    const ctx = {
      incidentId: incident.incidentId,
      agencyId: incident.agencyId,
      title: incident.title,
      callerAddressLine: incident.callerAddressLine ?? null,
      normalizedAddress,
    };

    let cadFields: Record<string, unknown> | null = null;
    let cadErr = false;
    try {
      if (cad.getCallerData) {
        cadFields = (await cad.getCallerData(ctx)) as Record<string, unknown>;
      }
    } catch {
      cadErr = true;
      cadFields = null;
    }

    const cadData = buildCadData(cadFields, cadErr);
    const locHint =
      !incident.callerAddressLine?.trim() && toStr(cadFields?.suggestedAddress)
        ? { mapLabel: toStr(cadFields?.suggestedAddress) }
        : null;

    const premiseNotes = normalizedAddress
      ? await premiseRepo.listForAddress(incident.agencyId, normalizedAddress)
      : [];

    const minCreatedAtIso = new Date(Date.now() - PRIOR_INCIDENT_WINDOW_MS).toISOString();
    let priorRaw =
      normalizedAddress && normalizedAddress.length > 0
        ? await incidentRepo.listByAgencyAndCallerAddressNormalizedSince(
            incident.agencyId,
            normalizedAddress,
            {
              excludeIncidentId: incident.incidentId,
              minCreatedAtIso,
              maxItems: MAX_PRIOR_COLLECT,
            },
          )
        : [];
    priorRaw = priorRaw
      .slice()
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0));
    const priorIncidentsTruncated = priorRaw.length >= MAX_PRIOR_COLLECT;
    const priorIncidentsTotal = priorRaw.length;
    const priorIncidents = priorRaw.slice(0, MAX_PRIOR_RETURN).map((p) => ({
      incidentId: p.incidentId,
      createdAt: p.createdAt,
      incidentType: p.category,
      summary: p.summary,
      disposition: p.status,
      resolution: p.status,
      priority: p.urgency,
      relativeTimeLabel: formatRelativeTimeShort(p.createdAt),
      source: "prior_incidents" as const,
    }));

    let addressTraumaFlags = {
      count: 0,
      mostRecentAt: null as string | null,
      mostRecentTraumaFlagType: null as string | null,
    };
    if (normalizedAddress && env.traumaFlagsTable) {
      try {
        const flags = await wellnessRepo.listByAgencyCallerAddressKey(
          incident.agencyId,
          normalizedAddress,
          200,
        );
        addressTraumaFlags.count = flags.length;
        const newest = flags[0];
        if (newest) {
          addressTraumaFlags.mostRecentAt = newest.createdAt;
          addressTraumaFlags.mostRecentTraumaFlagType =
            newest.matchedKeywords[0] ?? "Wellness trauma keyword";
        }
      } catch {
        addressTraumaFlags = { count: 0, mostRecentAt: null, mostRecentTraumaFlagType: null };
      }
    }

    const location = buildLocation(incident, locHint);
    const provenanceParts: string[] = [
      `Location: ${location.source === "incident" ? "incident record" : "CAD hint"}.`,
      `CAD: ${cadData.status} (${cadData.status === "unavailable" ? "adapter" : "integration"}).`,
      `Premise notes: ${premiseNotes.length} manual.`,
      `Prior incidents (12 mo): ${priorIncidentsTotal} matched; showing up to ${Math.min(DISPLAY_PRIOR_CAP, priorIncidents.length)} in UI (${priorIncidents.length} in payload).`,
      addressTraumaFlags.count > 0
        ? `Trauma flags at address: ${addressTraumaFlags.count}.`
        : "Trauma flags at address: none indexed.",
    ];

    return {
      incidentId: incident.incidentId,
      agencyId: incident.agencyId,
      normalizedAddress,
      location,
      priorIncidents,
      priorIncidentsTotal,
      ...(priorIncidentsTruncated ? { priorIncidentsTruncated: true } : {}),
      premiseNotes,
      addressTraumaFlags,
      cadData,
      provenanceSummary: provenanceParts.join(" "),
      generatedAt: new Date().toISOString(),
    };
  }

  async createPremiseNote(
    incidentId: string,
    user: UserContext,
    body: CreatePremiseNoteRequest,
  ): Promise<CreatePremiseNoteResponse | null> {
    if (!env.enableCallerCard) return null;
    const resolved = await resolveIncidentRead(incidentId, user);
    if (!resolved || resolved.kind === "shared") return null;
    const { incident } = resolved;

    const normalized =
      incident.callerAddressNormalized?.trim() ||
      (incident.callerAddressLine ? normalizeAddressForIndex(incident.callerAddressLine) : "");
    if (!normalized) {
      const err = new Error("NO_ADDRESS_ON_INCIDENT");
      (err as Error & { statusCode?: number }).statusCode = 400;
      throw err;
    }

    const now = new Date().toISOString();
    const noteId = makeId("pnm");
    const hazardType = body.hazardType ?? null;
    const isHazard = body.isHazard ?? Boolean(hazardType && hazardType !== "other");
    const knownOccupants = body.knownOccupants?.trim();
    const specialInstructions = body.specialInstructions?.trim();

    await premiseRepo.createNote({
      noteId,
      agencyId: incident.agencyId,
      normalizedAddress: normalized,
      incidentId: incident.incidentId,
      text: body.text.trim(),
      createdBy: user.userId,
      createdAt: now,
      ...(hazardType != null ? { hazardType } : {}),
      isHazard,
      ...(knownOccupants ? { knownOccupants } : {}),
      ...(specialInstructions ? { specialInstructions } : {}),
    });

    return {
      note: {
        noteId,
        agencyId: incident.agencyId,
        normalizedAddress: normalized,
        incidentId: incident.incidentId,
        text: body.text.trim(),
        createdBy: user.userId,
        createdAt: now,
        ...(hazardType != null ? { hazardType } : { hazardType: null }),
        isHazard,
        ...(knownOccupants ? { knownOccupants } : {}),
        ...(specialInstructions ? { specialInstructions } : {}),
      },
    };
  }

  async patchPremiseNote(
    incidentId: string,
    noteId: string,
    user: UserContext,
    body: PatchPremiseNoteRequest,
  ): Promise<PatchPremiseNoteResponse | null> {
    if (!env.enableCallerCard) return null;
    const resolved = await resolveIncidentRead(incidentId, user);
    if (!resolved || resolved.kind === "shared") return null;
    const { incident } = resolved;

    const normalized =
      incident.callerAddressNormalized?.trim() ||
      (incident.callerAddressLine ? normalizeAddressForIndex(incident.callerAddressLine) : "");
    if (!normalized) {
      const err = new Error("NO_ADDRESS_ON_INCIDENT");
      (err as Error & { statusCode?: number }).statusCode = 400;
      throw err;
    }

    const updated = await premiseRepo.updateNote(incident.agencyId, normalized, noteId, {
      text: body.text,
      hazardType: body.hazardType,
      isHazard: body.isHazard,
      knownOccupants: body.knownOccupants,
      specialInstructions: body.specialInstructions,
    });
    if (!updated) return null;

    const row = await premiseRepo.getNote(incident.agencyId, normalized, noteId);
    if (!row) return null;

    return {
      note: {
        noteId: row.noteId,
        agencyId: incident.agencyId,
        normalizedAddress: normalized,
        incidentId: incident.incidentId,
        text: row.text,
        createdBy: row.createdBy,
        createdAt: row.createdAt,
        ...(row.updatedAt ? { updatedAt: row.updatedAt } : {}),
        hazardType: row.hazardType ?? null,
        isHazard: row.isHazard,
        ...(row.knownOccupants ? { knownOccupants: row.knownOccupants } : {}),
        ...(row.specialInstructions ? { specialInstructions: row.specialInstructions } : {}),
      },
    };
  }
}
