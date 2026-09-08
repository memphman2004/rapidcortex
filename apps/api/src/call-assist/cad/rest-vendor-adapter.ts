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
import { submitCadVendorCreate } from "./vendor-live-submit.js";

const PROVIDER_META: Record<
  Exclude<CadProviderId, "mock">,
  { name: string; version: string }
> = {
  "motorola-premierone": { name: "Motorola PremierOne", version: "1.1.0" },
  "tyler-new-world": { name: "Tyler New World", version: "1.0.0" },
  "hexagon-intergraph": { name: "Hexagon I/CAD", version: "1.0.0" },
  centralsquare: { name: "CentralSquare", version: "1.0.0" },
  zetron: { name: "Zetron", version: "1.0.0" },
  mark43: { name: "Mark43", version: "1.0.0" },
  versaterm: { name: "Versaterm", version: "1.0.0" },
};

/**
 * Shared fail-closed REST CAD adapter. Live HTTP runs only after dual gates + human review.
 * Nearby/hazards/updates stay empty until a production agency completes UAT.
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
    _agencyId: string,
    cadIncidentId: string,
    _note: string,
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
    return {
      ok: false,
      blocked: true,
      pendingReview: false,
      cadIncidentId,
      reason: `${this.providerId.replace(/-/g, "_")}_update_requires_live_uat`,
      vendor: this.providerId,
    };
  }

  async findNearbyIncidents(
    _agencyId: string,
    _location: CadIncidentLocation,
  ): Promise<CadNearbyIncident[]> {
    const gated = evaluateCadPushGate({
      cadWritebackEnabled: env.cadWritebackEnabled,
      callAssistCadPushEnabled: env.enableCallAssistCadPush,
      humanReviewRequired: true,
      humanReviewApproved: true,
      demo: false,
    });
    if (gated) return [];
    return [];
  }

  async getPremiseHazards(
    _agencyId: string,
    _location: CadIncidentLocation,
  ): Promise<CallAssistPremiseHazard[]> {
    const gated = evaluateCadPushGate({
      cadWritebackEnabled: env.cadWritebackEnabled,
      callAssistCadPushEnabled: env.enableCallAssistCadPush,
      humanReviewRequired: true,
      humanReviewApproved: true,
      demo: false,
    });
    if (gated) return [];
    return [];
  }
}
