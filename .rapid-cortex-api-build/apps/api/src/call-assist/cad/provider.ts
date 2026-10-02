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

export interface CADProvider {
  getProviderInfo(): CadProviderInfo;
  createIncident(
    payload: CallAssistCadCreatePayload,
    options: CadCreateOptions,
  ): Promise<CadIncidentResult>;
  updateIncident(
    agencyId: string,
    cadIncidentId: string,
    note: string,
    options: CadCreateOptions,
  ): Promise<CadIncidentResult>;
  findNearbyIncidents(
    agencyId: string,
    location: CadIncidentLocation,
  ): Promise<CadNearbyIncident[]>;
  getPremiseHazards(agencyId: string, location: CadIncidentLocation): Promise<CallAssistPremiseHazard[]>;
  getUnitStatus?(agencyId: string): Promise<CadUnitStatus[]>;
  getLocationCallHistory?(
    agencyId: string,
    location: CadIncidentLocation,
  ): Promise<CadCallHistoryEntry[]>;
  addCadNote?(agencyId: string, cadIncidentId: string, note: string): Promise<void>;
}

export type CadPushGateInput = {
  cadWritebackEnabled: boolean;
  callAssistCadPushEnabled: boolean;
  humanReviewRequired: boolean;
  humanReviewApproved: boolean;
  demo: boolean;
};

/**
 * Dual fail-closed gate. Feature flags and admin prompts cannot bypass this.
 * Demo never calls a live vendor.
 */
export function evaluateCadPushGate(input: CadPushGateInput): CadIncidentResult | null {
  if (input.demo) {
    return {
      ok: true,
      blocked: false,
      pendingReview: false,
      cadIncidentId: "demo_cad_not_live",
      reason: "demo_mock_cad",
      vendor: "mock",
    };
  }
  if (!input.cadWritebackEnabled) {
    return {
      ok: false,
      blocked: true,
      pendingReview: false,
      reason: "cad_writeback_disabled",
    };
  }
  if (!input.callAssistCadPushEnabled) {
    return {
      ok: false,
      blocked: true,
      pendingReview: false,
      reason: "call_assist_cad_push_disabled",
    };
  }
  if (input.humanReviewRequired && !input.humanReviewApproved) {
    return {
      ok: false,
      blocked: false,
      pendingReview: true,
      reason: "human_review_required",
    };
  }
  return null;
}
