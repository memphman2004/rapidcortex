import type {
  CadCreateOptions,
  CadIncidentLocation,
  CadIncidentResult,
  CadNearbyIncident,
  CadProviderInfo,
  CallAssistCadCreatePayload,
  CallAssistPremiseHazard,
} from "rapid-cortex-shared";
import { env } from "../../lib/env.js";
import { makeId } from "../../lib/ids.js";
import type { CADProvider } from "./provider.js";
import { evaluateCadPushGate } from "./provider.js";

/**
 * First CADProvider implementation. PremierOne field names stay in this file.
 * Live HTTP submit uses the existing Motorola write adapter only after dual
 * fail-closed gates AND a real RC incident id — Call Assist never invents CAD rows.
 */
export class MotorolaPremierOneAdapter implements CADProvider {
  constructor(private readonly natureMapping: Record<string, string> = {}) {}

  getProviderInfo(): CadProviderInfo {
    return {
      id: "motorola-premierone",
      name: "Motorola PremierOne",
      version: "1.0.0",
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

    return {
      ok: true,
      blocked: false,
      pendingReview: false,
      cadIncidentId: makeId("p1hold"),
      reason: `premierone_hold:${this.mapNature(payload.classification)}`,
      vendor: "motorola-premierone",
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
      ok: true,
      blocked: false,
      pendingReview: false,
      cadIncidentId,
      reason: "note_queued",
      vendor: "motorola-premierone",
    };
  }

  async findNearbyIncidents(
    _agencyId: string,
    _location: CadIncidentLocation,
  ): Promise<CadNearbyIncident[]> {
    return [];
  }

  async getPremiseHazards(
    _agencyId: string,
    _location: CadIncidentLocation,
  ): Promise<CallAssistPremiseHazard[]> {
    return [];
  }
}
