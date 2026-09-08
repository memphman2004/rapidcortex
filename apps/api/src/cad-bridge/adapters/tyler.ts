import { randomUUID } from "node:crypto";
import type {
  BridgeEvent,
  BridgeEventType,
  CanonicalComment,
  CanonicalIncident,
  CanonicalLocation,
  IncidentPriority,
  CadBridgeIncidentStatus,
  UnitStatus,
} from "rapid-cortex-shared";
import { AdapterParseError, type CADAdapter, type CADAdapterEndpoints } from "./base.js";
import { asRecord, firstString, validateHmacSha256 } from "./hmac.js";

/**
 * Tyler New World mapping uses the same field names as `TylerNewWorldAdapter.sampleVendorPayloads`
 * plus the webhook envelope (`event.type` / `event.data`). Live UAT should confirm HMAC header
 * and status codes against the agency's NW version.
 */
const PRIORITY: Record<string, IncidentPriority> = {
  "1": 1, P1: 1,
  "2": 2, P2: 2,
  "3": 3, P3: 3,
  "4": 4, P4: 4,
  "5": 5, P5: 5,
};

const STATUS: Record<string, CadBridgeIncidentStatus> = {
  ACTIVE: "ACTIVE",
  OPEN: "ACTIVE",
  PENDING: "PENDING",
  DISP: "DISPATCHED",
  DISPATCHED: "DISPATCHED",
  ENRT: "DISPATCHED",
  ENROUTE: "DISPATCHED",
  SCENE: "ONSCENE",
  ONSCENE: "ONSCENE",
  CLOSED: "CLOSED",
  CANCELLED: "CANCELLED",
  CANCELED: "CANCELLED",
};

const UNIT_STATUS: Record<string, UnitStatus> = {
  AV: "AVAILABLE",
  AVAILABLE: "AVAILABLE",
  DP: "DISPATCHED",
  DISPATCHED: "DISPATCHED",
  ER: "ENROUTE",
  ENROUTE: "ENROUTE",
  ENRT: "ENROUTE",
  OS: "ONSCENE",
  ONSCENE: "ONSCENE",
  UN: "UNAVAILABLE",
};

const EVENT_TYPE: Record<string, BridgeEventType> = {
  "incident.created": "INCIDENT_CREATED",
  "incident.updated": "INCIDENT_UPDATED",
  "incident.closed": "INCIDENT_CLOSED",
  "incident.cancelled": "INCIDENT_CANCELLED",
  "unit.status": "UNIT_STATUS_CHANGED",
  "comment.added": "COMMENT_ADDED",
  INCIDENT_CREATED: "INCIDENT_CREATED",
  INCIDENT_UPDATED: "INCIDENT_UPDATED",
  INCIDENT_CLOSED: "INCIDENT_CLOSED",
};

export class TylerNewWorldBridgeAdapter implements CADAdapter {
  readonly vendor = "TYLER" as const;

  validateSignature(rawBody: string, signatureHeader: string, signingSecret: string): boolean {
    return validateHmacSha256(rawBody, signatureHeader, signingSecret);
  }

  async parseInbound(
    rawBody: string,
    _headers: Record<string, string | undefined>,
    agencyId: string,
  ): Promise<BridgeEvent> {
    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(rawBody) as Record<string, unknown>;
    } catch {
      throw new AdapterParseError(this.vendor, "Invalid JSON body");
    }
    const envelope = asRecord(payload.event ?? payload);
    const vendorEventType = String(envelope.type ?? envelope.eventType ?? payload.eventType ?? "");
    const data = asRecord(envelope.data ?? envelope.incidentData ?? payload);
    const sourceIncidentId =
      firstString(data, ["incidentId", "id", "inc_nbr"]) || firstString(payload, ["inc_nbr", "incidentId"]);
    if (!sourceIncidentId) {
      throw new AdapterParseError(this.vendor, "incidentId missing from payload");
    }
    return {
      eventId: randomUUID(),
      agencyId,
      sourceSlot: "CAD_A",
      eventType: EVENT_TYPE[vendorEventType] ?? EVENT_TYPE[vendorEventType.toUpperCase()] ?? "INCIDENT_UPDATED",
      sourceIncidentId,
      rawPayload: payload,
      receivedAt: new Date().toISOString(),
    };
  }

  toCanonical(event: BridgeEvent): Partial<CanonicalIncident> {
    const p = event.rawPayload;
    const envelope = asRecord(p.event);
    const data = asRecord(envelope.data ?? p.incidentData ?? p);
    const result: Partial<CanonicalIncident> = {};
    const type = firstString(data, ["incidentType", "call_type_cd", "callType"]);
    if (type) result.type = type;
    if (data.priority !== undefined || data.priority_nbr !== undefined) {
      result.priority = this.normalizePriority(data.priority ?? data.priority_nbr);
    }
    if (data.status !== undefined || data.inc_status_cd !== undefined) {
      result.status = this.normalizeStatus(data.status ?? data.inc_status_cd);
    }
    const narrative = firstString(data, ["narrative", "callNarrative"]);
    if (narrative) result.narrative = narrative;
    result.location = this.parseLocation(data);
    return result;
  }

  buildCreatePayload(canonical: CanonicalIncident): Record<string, unknown> {
    return {
      call_type_cd: canonical.type,
      incidentType: canonical.type,
      priority_nbr: canonical.priority,
      location_txt: canonical.location.address,
      lat_dec: canonical.location.latitude,
      lon_dec: canonical.location.longitude,
      narrative: canonical.narrative,
      sourceSystem: "RC_BRIDGE",
    };
  }

  buildUpdatePayload(
    incidentId: string,
    changes: Partial<CanonicalIncident>,
    _eventType: BridgeEventType,
  ): Record<string, unknown> {
    return {
      incidentId,
      inc_nbr: incidentId,
      ...(changes.priority !== undefined ? { priority_nbr: changes.priority } : {}),
      ...(changes.status !== undefined ? { inc_status_cd: changes.status } : {}),
      ...(changes.type !== undefined ? { call_type_cd: changes.type } : {}),
      ...(changes.narrative !== undefined ? { narrative: changes.narrative } : {}),
      ...(changes.location !== undefined ? { location_txt: changes.location.address } : {}),
    };
  }

  buildCommentPayload(incidentId: string, comment: CanonicalComment): Record<string, unknown> {
    return {
      incidentId,
      text: comment.text,
      authorId: comment.authorId,
      timestamp: comment.timestamp,
      source: "RC_BRIDGE",
    };
  }

  buildClosePayload(incidentId: string, status: "CLOSED" | "CANCELLED"): Record<string, unknown> {
    return { incidentId, inc_nbr: incidentId, status, closedAt: new Date().toISOString() };
  }

  getEndpoints(): CADAdapterEndpoints {
    return {
      createIncident: "/api/cad/incidents",
      updateIncident: "/api/cad/incidents/{id}",
      addComment: "/api/cad/incidents/{id}/notes",
      closeIncident: "/api/cad/incidents/{id}/close",
      health: "/api/cad/health",
      listIncidents: "/api/cad/incidents",
    };
  }

  normalizePriority(vendorPriority: unknown): IncidentPriority {
    return PRIORITY[String(vendorPriority ?? "").toUpperCase().trim()] ?? 3;
  }

  normalizeStatus(vendorStatus: unknown): CadBridgeIncidentStatus {
    return STATUS[String(vendorStatus ?? "").toUpperCase().trim()] ?? "ACTIVE";
  }

  normalizeUnitStatus(vendorStatus: unknown): UnitStatus {
    return UNIT_STATUS[String(vendorStatus ?? "").toUpperCase().trim()] ?? "UNAVAILABLE";
  }

  extractCreatedIncidentId(responseBody: Record<string, unknown>): string {
    const id = firstString(responseBody, ["incidentId", "id", "inc_nbr"]);
    if (!id) throw new AdapterParseError(this.vendor, "No incidentId in create response");
    return id;
  }

  private parseLocation(data: Record<string, unknown>): CanonicalLocation {
    const loc = asRecord(data.location);
    return {
      address: firstString(loc, ["address"]) || firstString(data, ["location_txt", "address"]),
      city: firstString(loc, ["city"]),
      state: firstString(loc, ["state"]),
      zip: firstString(loc, ["zip"]) || undefined,
      latitude: typeof loc.lat_dec === "number" ? loc.lat_dec : typeof data.lat_dec === "number" ? data.lat_dec : undefined,
      longitude: typeof loc.lon_dec === "number" ? loc.lon_dec : typeof data.lon_dec === "number" ? data.lon_dec : undefined,
    };
  }
}
