/**
 * Canonical integration/domain events — wire telemetry, webhooks, and CAD bridges into one shape.
 * Use `type` as the discriminant for consumers and audit exporters.
 */
export type IntegrationDomainEvent =
  | {
      type: "incident.created";
      agencyId: string;
      incidentId: string;
      title?: string;
      at: string;
    }
  | {
      type: "transcript.received";
      agencyId: string;
      incidentId: string;
      segmentId: string;
      at: string;
    }
  | {
      type: "analysis.generated";
      agencyId: string;
      incidentId: string;
      analysisId: string;
      provider?: string;
      at: string;
    }
  | {
      type: "escalation.raised";
      agencyId: string;
      incidentId: string;
      reason?: string;
      at: string;
    }
  | {
      type: "incident.closed";
      agencyId: string;
      incidentId: string;
      at: string;
    }
  | {
      type: "integration.connected";
      agencyId: string;
      connectorId: string;
      at: string;
    }
  | {
      type: "integration.disconnected";
      agencyId: string;
      connectorId: string;
      reason?: string;
      at: string;
    }
  /** Legacy CAD-style feed events (still supported by mock feeds). */
  | { type: "cad.status"; payload: unknown; at?: string }
  | { type: "unit.assigned"; unitId: string; at?: string }
  | { type: "location.update"; lat: number; lon: number; at?: string };
