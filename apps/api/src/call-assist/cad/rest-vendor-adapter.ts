import type {
  CadCreateOptions,
  CadIncidentLocation,
  CadIncidentResult,
  CadNearbyIncident,
  CadProviderId,
  CadProviderInfo,
  CallAssistCadCreatePayload,
  CallAssistPremiseHazard,
} from "rapid-cortex-shared";
import { env } from "../../lib/env.js";
import { makeId } from "../../lib/ids.js";
import type { CADProvider } from "./provider.js";
import { evaluateCadPushGate } from "./provider.js";
import {
  fetchCadVendorHazards,
  fetchCadVendorNearby,
  submitCadVendorCreate,
  submitCadVendorUpdate,
} from "./vendor-live-submit.js";

const PROVIDER_META: Record<
  Exclude<CadProviderId, "mock">,
  { name: string; version: string }
> = {
  "motorola-premierone": { name: "Motorola PremierOne", version: "1.2.0" },
  "tyler-new-world": { name: "Tyler New World", version: "1.1.0" },
  "hexagon-intergraph": { name: "Hexagon I/CAD", version: "1.1.0" },
  centralsquare: { name: "CentralSquare", version: "1.1.0" },
  zetron: { name: "Zetron", version: "1.1.0" },
  mark43: { name: "Mark43", version: "1.1.0" },
  versaterm: { name: "Versaterm", version: "1.1.0" },
};

function mapNearby(rows: Array<Record<string, unknown>>): CadNearbyIncident[] {
  return rows.slice(0, 25).map((row, idx) => ({
    cadIncidentId: String(row.EventNumber ?? row.incidentId ?? row.id ?? `nearby-${idx}`),
    nature: String(row.CallType ?? row.nature ?? row.type ?? "UNKNOWN"),
    locationText: String(row.Address ?? row.address ?? row.location ?? row.locationText ?? ""),
    status: String(row.Status ?? row.status ?? "active"),
    openedAt: typeof row.openedAt === "string" ? row.openedAt : undefined,
  }));
}

function mapHazards(rows: Array<Record<string, unknown>>): CallAssistPremiseHazard[] {
  return rows.slice(0, 25).map((row, idx) => {
    const summary = String(row.summary ?? row.description ?? row.Description ?? row.notes ?? "Premise hazard");
    const officerSafetyRaw = row.officerSafety ?? row.OfficerSafety ?? row.safetyFlag;
    return {
      code: String(row.code ?? row.HazardCode ?? row.type ?? `HAZ-${idx}`),
      summary,
      officerSafety:
        officerSafetyRaw === true ||
        String(officerSafetyRaw).toLowerCase() === "true" ||
        String(row.severity ?? "").toLowerCase() === "high",
    };
  });
}

/**
 * Shared fail-closed REST CAD adapter. Live HTTP runs only after dual gates + human review.
 * Nearby/hazards/updates call the configured agency connector once gates are open.
 */
export class RestVendorCadAdapter implements CADProvider {
  constructor(
    private readonly providerId: Exclude<CadProviderId, "mock">,
    private readonly natureMapping: Record<string, string> = {},
  ) {}

  getProviderInfo(): CadProviderInfo {
    const meta = PROVIDER_META[this.providerId];
    return {
      id: this.providerId,
      name: meta.name,
      version: meta.version,
      capabilities: [
        "CREATE_INCIDENT",
        "UPDATE_INCIDENT",
        "NEARBY_INCIDENTS",
        "PREMISE_HAZARDS",
        "DUPLICATE_DETECTION",
        "CAD_NOTES",
        "CALL_HISTORY",
      ],
    };
  }

  mapNature(classification: string): string {
    return this.natureMapping[classification] ?? this.natureMapping.UNKNOWN ?? "UNK";
  }

  async createIncident(
    payload: CallAssistCadCreatePayload,
    options: CadCreateOptions,
  ): Promise<CadIncidentResult> {
    const gated = evaluateCadPushGate({
      cadWritebackEnabled: env.cadWritebackEnabled,
      callAssistCadPushEnabled: env.enableCallAssistCadPush,
      humanReviewRequired: true,
      humanReviewApproved: options.humanReviewApproved,
      demo: Boolean(options.demo),
    });
    if (gated) return gated;

    const live = await submitCadVendorCreate(this.providerId, {
      ...payload,
      classification: this.mapNature(payload.classification),
    });
    if (!live.ok) {
      return {
        ok: false,
        blocked: true,
        pendingReview: false,
        reason: live.reason,
        vendor: this.providerId,
      };
    }
    return {
      ok: true,
      blocked: false,
      pendingReview: false,
      cadIncidentId: live.cadIncidentId ?? makeId(this.providerId.slice(0, 8)),
      reason: live.reason,
      vendor: this.providerId,
    };
  }

  async updateIncident(
    agencyId: string,
    cadIncidentId: string,
    note: string,
    options: CadCreateOptions,
  ): Promise<CadIncidentResult> {
    const gated = evaluateCadPushGate({
      cadWritebackEnabled: env.cadWritebackEnabled,
      callAssistCadPushEnabled: env.enableCallAssistCadPush,
      humanReviewRequired: true,
      humanReviewApproved: options.humanReviewApproved,
      demo: Boolean(options.demo),
    });
    if (gated) return { ...gated, cadIncidentId };
    const live = await submitCadVendorUpdate(this.providerId, agencyId, cadIncidentId, note);
    if (!live.ok) {
      return {
        ok: false,
        blocked: true,
        pendingReview: false,
        cadIncidentId,
        reason: live.reason,
        vendor: this.providerId,
      };
    }
    return {
      ok: true,
      blocked: false,
      pendingReview: false,
      cadIncidentId,
      reason: live.reason,
      vendor: this.providerId,
    };
  }

  async findNearbyIncidents(
    agencyId: string,
    location: CadIncidentLocation,
  ): Promise<CadNearbyIncident[]> {
    const gated = evaluateCadPushGate({
      cadWritebackEnabled: env.cadWritebackEnabled,
      callAssistCadPushEnabled: env.enableCallAssistCadPush,
      humanReviewRequired: true,
      humanReviewApproved: true,
      demo: false,
    });
    if (gated) return [];
    const live = await fetchCadVendorNearby(this.providerId, agencyId, location);
    return mapNearby(live.items);
  }

  async getPremiseHazards(
    agencyId: string,
    location: CadIncidentLocation,
  ): Promise<CallAssistPremiseHazard[]> {
    const gated = evaluateCadPushGate({
      cadWritebackEnabled: env.cadWritebackEnabled,
      callAssistCadPushEnabled: env.enableCallAssistCadPush,
      humanReviewRequired: true,
      humanReviewApproved: true,
      demo: false,
    });
    if (gated) return [];
    const live = await fetchCadVendorHazards(this.providerId, agencyId, location);
    return mapHazards(live.items);
  }
}
