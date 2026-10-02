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
import type { CADProvider } from "./provider.js";
import { mockNearbyIncidents, mockPremiseHazards } from "./mock-cad-context.js";

export class MockCadAdapter implements CADProvider {
  getProviderInfo(): CadProviderInfo {
    return {
      id: "mock",
      name: "CAD provider not configured",
      version: "1.0.0",
      capabilities: [],
    };
  }

  async createIncident(
    _payload: CallAssistCadCreatePayload,
    _options: CadCreateOptions,
  ): Promise<CadIncidentResult> {
    return {
      ok: false,
      blocked: true,
      pendingReview: false,
      reason: "cad_provider_not_configured",
    };
  }

  async updateIncident(
    _agencyId: string,
    cadIncidentId: string,
    _note: string,
    _options: CadCreateOptions,
  ): Promise<CadIncidentResult> {
    return {
      ok: false,
      blocked: true,
      pendingReview: false,
      cadIncidentId,
      reason: "cad_provider_not_configured",
    };
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
