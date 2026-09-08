import type {
  CadCallHistoryEntry,
  CadCreateOptions,
  CadIncidentLocation,
  CadIncidentResult,
  CadNearbyIncident,
  CadProviderInfo,
  CadUnitStatus,
  CallAssistCadCreatePayload,
  CallAssistPremiseHazard,
} from "rapid-cortex-shared";
import { makeId } from "../../lib/ids.js";
import type { CADProvider } from "./provider.js";
import { evaluateCadPushGate } from "./provider.js";
import { mockNearbyIncidents, mockPremiseHazards } from "./mock-cad-context.js";

export class MockCadAdapter implements CADProvider {
  getProviderInfo(): CadProviderInfo {
    return {
      id: "mock",
      name: "Mock CAD",
      version: "1.0.0",
      capabilities: [
        "CREATE_INCIDENT",
        "UPDATE_INCIDENT",
        "NEARBY_INCIDENTS",
        "PREMISE_HAZARDS",
        "DUPLICATE_DETECTION",
        "CAD_NOTES",
      ],
    };
  }

  async createIncident(
    payload: CallAssistCadCreatePayload,
    options: CadCreateOptions,
  ): Promise<CadIncidentResult> {
    const gated = evaluateCadPushGate({
      cadWritebackEnabled: true,
      callAssistCadPushEnabled: true,
      humanReviewRequired: true,
      humanReviewApproved: options.humanReviewApproved,
      demo: Boolean(options.demo),
    });
    if (gated && (gated.blocked || gated.pendingReview || options.demo)) {
      if (options.demo) return { ...gated, cadIncidentId: makeId("cad_demo") };
      return gated;
    }
    return {
      ok: true,
      blocked: false,
      pendingReview: false,
      cadIncidentId: makeId("cad_mock"),
      reason: "mock_created",
      vendor: "mock",
    };
  }

  async updateIncident(
    _agencyId: string,
    cadIncidentId: string,
    _note: string,
    options: CadCreateOptions,
  ): Promise<CadIncidentResult> {
    if (options.demo) {
      return { ok: true, blocked: false, pendingReview: false, cadIncidentId, reason: "demo_mock_cad", vendor: "mock" };
    }
    return { ok: true, blocked: false, pendingReview: false, cadIncidentId, reason: "mock_updated", vendor: "mock" };
  }

  async findNearbyIncidents(_agencyId: string, location: CadIncidentLocation): Promise<CadNearbyIncident[]> {
    return mockNearbyIncidents(location);
  }

  async getPremiseHazards(_agencyId: string, location: CadIncidentLocation): Promise<CallAssistPremiseHazard[]> {
    return mockPremiseHazards(location);
  }

  async getUnitStatus(): Promise<CadUnitStatus[]> {
    return [];
  }

  async getLocationCallHistory(): Promise<CadCallHistoryEntry[]> {
    return [];
  }

  async addCadNote(): Promise<void> {
    return;
  }
}
