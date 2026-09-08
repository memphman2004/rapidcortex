import type {
  BridgeEvent,
  BridgeEventType,
  CADVendor,
  CanonicalComment,
  CanonicalIncident,
  IncidentPriority,
  CadBridgeIncidentStatus,
  UnitStatus,
} from "rapid-cortex-shared";

export interface CADAdapterEndpoints {
  createIncident: string;
  updateIncident: string;
  addComment: string;
  closeIncident: string;
  health: string;
  listIncidents: string;
}

export interface CADAdapter {
  readonly vendor: CADVendor;
  validateSignature(rawBody: string, signatureHeader: string, signingSecret: string): boolean;
  parseInbound(
    rawBody: string,
    headers: Record<string, string | undefined>,
    agencyId: string,
  ): Promise<BridgeEvent>;
  toCanonical(event: BridgeEvent): Partial<CanonicalIncident>;
  buildCreatePayload(canonical: CanonicalIncident): Record<string, unknown>;
  buildUpdatePayload(
    incidentId: string,
    changes: Partial<CanonicalIncident>,
    eventType: BridgeEventType,
  ): Record<string, unknown>;
  buildCommentPayload(incidentId: string, comment: CanonicalComment): Record<string, unknown>;
  buildClosePayload(incidentId: string, status: "CLOSED" | "CANCELLED"): Record<string, unknown>;
  getEndpoints(): CADAdapterEndpoints;
  normalizePriority(vendorPriority: unknown): IncidentPriority;
  normalizeStatus(vendorStatus: unknown): CadBridgeIncidentStatus;
  normalizeUnitStatus(vendorStatus: unknown): UnitStatus;
  extractCreatedIncidentId(responseBody: Record<string, unknown>): string;
}

export class AdapterParseError extends Error {
  constructor(
    public vendor: CADVendor,
    message: string,
  ) {
    super(`[${vendor}] Parse error: ${message}`);
    this.name = "AdapterParseError";
  }
}

export class AdapterPublishError extends Error {
  constructor(
    public vendor: CADVendor,
    message: string,
    public statusCode?: number,
  ) {
    super(`[${vendor}] Publish error (${statusCode ?? "?"}): ${message}`);
    this.name = "AdapterPublishError";
  }
}
