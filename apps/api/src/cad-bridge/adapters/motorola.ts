import { randomUUID } from "node:crypto";
import type {
  BridgeEvent,
  BridgeEventType,
  CanonicalComment,
  CanonicalIncident,
  CanonicalLocation,
  CanonicalUnit,
  CADSlot,
  IncidentPriority,
  CadBridgeIncidentStatus,
  UnitStatus,
} from "rapid-cortex-shared";
import { AdapterParseError, type CADAdapter, type CADAdapterEndpoints } from "./base.js";
import { asRecord, firstString, validateHmacSha256 } from "./hmac.js";

const PRIORITY: Record<string, IncidentPriority> = {
  "1": 1, P1: 1, PRIORITY1: 1, EMERGENCY: 1,
  "2": 2, P2: 2, PRIORITY2: 2, URGENT: 2,
  "3": 3, P3: 3, PRIORITY3: 3, HIGH: 3,
  "4": 4, P4: 4, PRIORITY4: 4, ROUTINE: 4,
  "5": 5, P5: 5, PRIORITY5: 5, LOW: 5,
};

const STATUS: Record<string, CadBridgeIncidentStatus> = {
  PENDING: "PENDING",
  ACTIVE: "ACTIVE",
  OPEN: "ACTIVE",
  DISPATCHED: "DISPATCHED",
  ONSCENE: "ONSCENE",
  "ON SCENE": "ONSCENE",
  SCENE: "ONSCENE",
  CLEARING: "CLEARING",
  CLOSED: "CLOSED",
  COMPLETE: "CLOSED",
  CANCELLED: "CANCELLED",
  CANCELED: "CANCELLED",
  VOIDED: "CANCELLED",
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
  "ON SCENE": "ONSCENE",
  TR: "TRANSPORTING",
  TRANSPORTING: "TRANSPORTING",
  OOS: "OUT_OF_SERVICE",
  "OUT OF SERVICE": "OUT_OF_SERVICE",
  UN: "UNAVAILABLE",
  UNAVAILABLE: "UNAVAILABLE",
};

const EVENT_TYPE: Record<string, BridgeEventType> = {
  INCIDENT_CREATED: "INCIDENT_CREATED",
  INCIDENT_UPDATED: "INCIDENT_UPDATED",
  INCIDENT_CLOSED: "INCIDENT_CLOSED",
  INCIDENT_CANCELLED: "INCIDENT_CANCELLED",
  INCIDENT_CANCELED: "INCIDENT_CANCELLED",
  UNIT_STATUS_CHANGE: "UNIT_STATUS_CHANGED",
  UNIT_STATUS_CHANGED: "UNIT_STATUS_CHANGED",
  UNIT_ASSIGNED: "UNIT_ASSIGNED",
  UNIT_RELEASED: "UNIT_RELEASED",
  COMMENT_ADDED: "COMMENT_ADDED",
  NOTE_ADDED: "COMMENT_ADDED",
  PRIORITY_CHANGE: "PRIORITY_CHANGED",
  TYPE_CHANGE: "TYPE_CHANGED",
  LOCATION_UPDATED: "LOCATION_UPDATED",
};

export class MotorolaPremierOneBridgeAdapter implements CADAdapter {
  readonly vendor = "MOTOROLA" as const;

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
    const vendorEventType = String(payload.eventType ?? payload.EventType ?? "").toUpperCase();
    const incident = asRecord(payload.incidentData ?? payload.incident ?? payload);
    const sourceIncidentId = firstString(incident, ["incidentId", "id", "EventNumber"]) ||
      firstString(payload, ["incidentId", "EventNumber"]);
    if (!sourceIncidentId) {
      throw new AdapterParseError(this.vendor, "incidentId missing from payload");
    }
    return {
      eventId: randomUUID(),
      agencyId,
      sourceSlot: "CAD_A",
      eventType: EVENT_TYPE[vendorEventType] ?? "INCIDENT_UPDATED",
      sourceIncidentId,
      rawPayload: payload,
      receivedAt: new Date().toISOString(),
    };
  }

  toCanonical(event: BridgeEvent): Partial<CanonicalIncident> {
    const p = event.rawPayload;
    const incident = asRecord(p.incidentData ?? p.incident ?? p);
    const result: Partial<CanonicalIncident> = {};
    const type = firstString(incident, ["incidentType", "callType", "CallType"]);
    if (type) result.type = type;
    if (incident.priority !== undefined || incident.Priority !== undefined) {
      result.priority = this.normalizePriority(incident.priority ?? incident.Priority);
    }
    if (incident.status !== undefined || incident.IncidentStatus !== undefined) {
      result.status = this.normalizeStatus(incident.status ?? incident.IncidentStatus);
    }
    const narrative = firstString(incident, ["narrative", "callNarrative"]);
    if (narrative) result.narrative = narrative;
    result.location = this.parseLocation(incident);
    if (Array.isArray(incident.units) || Array.isArray(incident.Units)) {
      const units = (incident.units ?? incident.Units) as unknown[];
      result.units = units.map((u) => this.parseUnit(asRecord(u), event.sourceSlot));
    }
    const caller = asRecord(incident.caller);
    if (Object.keys(caller).length > 0 || incident.CallerName || incident.CallerPhone) {
      result.caller = {
        callbackNumber: firstString(caller, ["callbackNumber"]) || firstString(incident, ["CallerPhone"]) || undefined,
        name: firstString(caller, ["name"]) || firstString(incident, ["CallerName"]) || undefined,
        ani: firstString(caller, ["ani"]) || undefined,
        ali: firstString(caller, ["ali"]) || undefined,
      };
    }
    if (Array.isArray(incident.comments)) {
      result.comments = incident.comments.map((c) =>
        this.parseComment(asRecord(c), event.sourceSlot, event.sourceIncidentId),
      );
    }
    return result;
  }

  buildCreatePayload(canonical: CanonicalIncident): Record<string, unknown> {
    return {
      eventType: "INCIDENT_CREATED",
      CallType: canonical.type,
      Priority: canonical.priority,
      incidentData: {
        callType: canonical.type,
        priority: `P${canonical.priority}`,
        callNarrative: canonical.narrative,
        location: this.buildLocationPayload(canonical.location),
        caller: canonical.caller,
        sourceSystem: "RC_BRIDGE",
      },
    };
  }

  buildUpdatePayload(
    incidentId: string,
    changes: Partial<CanonicalIncident>,
    eventType: BridgeEventType,
  ): Record<string, unknown> {
    const patch: Record<string, unknown> = { incidentId };
    if (changes.priority !== undefined) patch.priority = `P${changes.priority}`;
    if (changes.status !== undefined) patch.status = changes.status;
    if (changes.type !== undefined) patch.callType = changes.type;
    if (changes.narrative !== undefined) patch.callNarrative = changes.narrative;
    if (changes.location !== undefined) patch.location = this.buildLocationPayload(changes.location);
    if (changes.units !== undefined) {
      patch.units = changes.units.map((u) => ({ unitId: u.unitId, callSign: u.callSign, status: u.status }));
    }
    return { eventType, incidentData: patch };
  }

  buildCommentPayload(incidentId: string, comment: CanonicalComment): Record<string, unknown> {
    return {
      incidentId,
      comment: {
        text: comment.text,
        authorId: comment.authorId,
        authorName: comment.authorName,
        timestamp: comment.timestamp,
        source: "RC_BRIDGE",
      },
    };
  }

  buildClosePayload(incidentId: string, status: "CLOSED" | "CANCELLED"): Record<string, unknown> {
    return {
      incidentId,
      incidentData: {
        status,
        closedAt: new Date().toISOString(),
        closedBy: "RC_BRIDGE",
      },
    };
  }

  getEndpoints(): CADAdapterEndpoints {
    return {
      createIncident: "/api/v1/incidents",
      updateIncident: "/api/v1/incidents/{id}",
      addComment: "/api/v1/incidents/{id}/comments",
      closeIncident: "/api/v1/incidents/{id}/close",
      health: "/api/v1/health",
      listIncidents: "/api/v1/incidents",
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
    const nested = asRecord(responseBody.incidentData);
    const id = firstString(responseBody, ["incidentId", "id", "EventNumber"]) || firstString(nested, ["incidentId"]);
    if (!id) throw new AdapterParseError(this.vendor, "No incidentId in create response");
    return id;
  }

  private parseLocation(incident: Record<string, unknown>): CanonicalLocation {
    const loc = asRecord(incident.location ?? incident.Location ?? incident.address);
    return {
      address: firstString(loc, ["address", "streetAddress", "FullAddress"]) || firstString(incident, ["address"]),
      city: firstString(loc, ["city"]),
      state: firstString(loc, ["state"]),
      zip: firstString(loc, ["zip"]) || undefined,
      crossStreets: firstString(loc, ["crossStreets"]) || undefined,
      building: firstString(loc, ["building"]) || undefined,
      floor: firstString(loc, ["floor"]) || undefined,
      unit: firstString(loc, ["unit", "apartment"]) || undefined,
      latitude: typeof loc.latitude === "number" ? loc.latitude : typeof loc.Latitude === "number" ? loc.Latitude : undefined,
      longitude: typeof loc.longitude === "number" ? loc.longitude : typeof loc.Longitude === "number" ? loc.Longitude : undefined,
      locationId: firstString(loc, ["premiseId", "locationId"]) || undefined,
    };
  }

  private parseUnit(u: Record<string, unknown>, cadSlot: CADSlot): CanonicalUnit {
    return {
      unitId: firstString(u, ["unitId", "id", "UnitId"]),
      cadSlot,
      callSign: firstString(u, ["callSign", "unitCallSign", "CallSign"]),
      status: this.normalizeUnitStatus(u.status ?? u.unitStatus ?? u.Status),
      radioId: firstString(u, ["radioId"]) || undefined,
      latitude: typeof u.latitude === "number" ? u.latitude : undefined,
      longitude: typeof u.longitude === "number" ? u.longitude : undefined,
    };
  }

  private parseComment(c: Record<string, unknown>, cadSlot: CADSlot, sourceIncidentId: string): CanonicalComment {
    return {
      commentId: firstString(c, ["commentId", "id"]) || randomUUID(),
      cadSlot,
      sourceIncidentId,
      text: firstString(c, ["text", "content", "noteText"]),
      authorId: firstString(c, ["authorId", "userId"]) || "UNKNOWN",
      authorName: firstString(c, ["authorName", "userName"]) || "Unknown",
      timestamp: c.timestamp ? new Date(String(c.timestamp)).toISOString() : new Date().toISOString(),
      isBridged: String(c.source ?? "").toUpperCase() === "RC_BRIDGE",
    };
  }

  private buildLocationPayload(loc: CanonicalLocation): Record<string, unknown> {
    return {
      streetAddress: loc.address,
      FullAddress: loc.address,
      city: loc.city,
      state: loc.state,
      zip: loc.zip,
      latitude: loc.latitude,
      longitude: loc.longitude,
    };
  }
}
