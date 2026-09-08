import { randomUUID } from "node:crypto";
import type {
  BridgeEvent,
  BridgeEventType,
  CADVendor,
  CanonicalComment,
  CanonicalIncident,
  CanonicalLocation,
  IncidentPriority,
  CadBridgeIncidentStatus,
  UnitStatus,
} from "rapid-cortex-shared";
import { AdapterParseError, type CADAdapter, type CADAdapterEndpoints } from "./base.js";
import { asRecord, firstString, validateHmacSha256 } from "./hmac.js";

interface RestVendorSpec {
  vendor: CADVendor;
  endpoints: CADAdapterEndpoints;
  incidentIdKeys: string[];
  typeKeys: string[];
  priorityKeys: string[];
  statusKeys: string[];
  addressKeys: string[];
  latKeys: string[];
  lonKeys: string[];
  eventTypeKeys: string[];
  statusMap: Record<string, CadBridgeIncidentStatus>;
}

const SHARED_STATUS: Record<string, CadBridgeIncidentStatus> = {
  ACTIVE: "ACTIVE",
  OPEN: "ACTIVE",
  PENDING: "PENDING",
  DISPATCHED: "DISPATCHED",
  DISP: "DISPATCHED",
  ENRT: "DISPATCHED",
  ENROUTE: "DISPATCHED",
  SCENE: "ONSCENE",
  ONSCENE: "ONSCENE",
  CLOSED: "CLOSED",
  CANCELLED: "CANCELLED",
  CANCELED: "CANCELLED",
};

const SPECS: RestVendorSpec[] = [
  {
    vendor: "CENTRALSQUARE",
    endpoints: {
      createIncident: "/api/calls",
      updateIncident: "/api/calls/{id}",
      addComment: "/api/calls/{id}/notes",
      closeIncident: "/api/calls/{id}/close",
      health: "/api/health",
      listIncidents: "/api/calls",
    },
    incidentIdKeys: ["call_number", "incidentId", "id"],
    typeKeys: ["call_type", "incidentType"],
    priorityKeys: ["priority"],
    statusKeys: ["call_status", "status"],
    addressKeys: ["address"],
    latKeys: ["lat"],
    lonKeys: ["lng", "lon"],
    eventTypeKeys: ["eventType", "type"],
    statusMap: { ...SHARED_STATUS, dispatched: "DISPATCHED" },
  },
  {
    vendor: "HEXAGON",
    endpoints: {
      createIncident: "/icad/api/calls",
      updateIncident: "/icad/api/calls/{id}",
      addComment: "/icad/api/calls/{id}/notes",
      closeIncident: "/icad/api/calls/{id}/close",
      health: "/icad/api/health",
      listIncidents: "/icad/api/calls",
    },
    incidentIdKeys: ["CallId", "incidentId", "id"],
    typeKeys: ["CallCode", "incidentType"],
    priorityKeys: ["CallPriority", "priority"],
    statusKeys: ["CallStatus", "status"],
    addressKeys: ["EntryAddress", "address"],
    latKeys: ["Latitude", "lat"],
    lonKeys: ["Longitude", "lon"],
    eventTypeKeys: ["eventType", "EventType"],
    statusMap: SHARED_STATUS,
  },
  {
    vendor: "SPILLMAN",
    endpoints: {
      createIncident: "/flex/api/calls",
      updateIncident: "/flex/api/calls/{id}",
      addComment: "/flex/api/calls/{id}/notes",
      closeIncident: "/flex/api/calls/{id}/close",
      health: "/flex/api/health",
      listIncidents: "/flex/api/calls",
    },
    incidentIdKeys: ["callId", "incidentId", "id"],
    typeKeys: ["callType", "incidentType"],
    priorityKeys: ["priority"],
    statusKeys: ["callStatus", "status"],
    addressKeys: ["address"],
    latKeys: ["gpsLat", "lat"],
    lonKeys: ["gpsLon", "lon"],
    eventTypeKeys: ["eventType", "type"],
    statusMap: SHARED_STATUS,
  },
];

export class RestVendorBridgeAdapter implements CADAdapter {
  readonly vendor: CADVendor;
  private readonly spec: RestVendorSpec;

  constructor(vendor: "CENTRALSQUARE" | "HEXAGON" | "SPILLMAN") {
    const spec = SPECS.find((s) => s.vendor === vendor);
    if (!spec) throw new Error(`Unsupported rest vendor ${vendor}`);
    this.spec = spec;
    this.vendor = vendor;
  }

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
    const data = asRecord(payload.data ?? payload.call ?? payload);
    const sourceIncidentId =
      firstString(data, this.spec.incidentIdKeys) || firstString(payload, this.spec.incidentIdKeys);
    if (!sourceIncidentId) {
      throw new AdapterParseError(this.vendor, "incidentId missing from payload");
    }
    const vendorType = firstString(payload, this.spec.eventTypeKeys).toUpperCase();
    const eventType: BridgeEventType =
      vendorType.includes("CREATE")
        ? "INCIDENT_CREATED"
        : vendorType.includes("CLOSE")
          ? "INCIDENT_CLOSED"
          : vendorType.includes("COMMENT") || vendorType.includes("NOTE")
            ? "COMMENT_ADDED"
            : "INCIDENT_UPDATED";
    return {
      eventId: randomUUID(),
      agencyId,
      sourceSlot: "CAD_A",
      eventType,
      sourceIncidentId,
      rawPayload: payload,
      receivedAt: new Date().toISOString(),
    };
  }

  toCanonical(event: BridgeEvent): Partial<CanonicalIncident> {
    const payload = event.rawPayload;
    const data = asRecord(payload.data ?? payload.call ?? payload.location ?? payload);
    const loc = asRecord(data.location ?? payload.location);
    const result: Partial<CanonicalIncident> = {};
    const type = firstString(data, this.spec.typeKeys) || firstString(payload, this.spec.typeKeys);
    if (type) result.type = type;
    const priority = data[this.spec.priorityKeys[0]!] ?? payload[this.spec.priorityKeys[0]!];
    if (priority !== undefined) result.priority = this.normalizePriority(priority);
    const status = data[this.spec.statusKeys[0]!] ?? payload[this.spec.statusKeys[0]!];
    if (status !== undefined) result.status = this.normalizeStatus(status);
    result.location = this.parseLocation(data, loc, payload);
    return result;
  }

  buildCreatePayload(canonical: CanonicalIncident): Record<string, unknown> {
    return {
      [this.spec.typeKeys[0]!]: canonical.type,
      [this.spec.priorityKeys[0]!]: canonical.priority,
      [this.spec.addressKeys[0]!]: canonical.location.address,
      sourceSystem: "RC_BRIDGE",
      narrative: canonical.narrative,
    };
  }

  buildUpdatePayload(
    incidentId: string,
    changes: Partial<CanonicalIncident>,
    _eventType: BridgeEventType,
  ): Record<string, unknown> {
    return {
      [this.spec.incidentIdKeys[0]!]: incidentId,
      ...(changes.priority !== undefined ? { [this.spec.priorityKeys[0]!]: changes.priority } : {}),
      ...(changes.status !== undefined ? { [this.spec.statusKeys[0]!]: changes.status } : {}),
      ...(changes.type !== undefined ? { [this.spec.typeKeys[0]!]: changes.type } : {}),
      ...(changes.location !== undefined ? { [this.spec.addressKeys[0]!]: changes.location.address } : {}),
    };
  }

  buildCommentPayload(incidentId: string, comment: CanonicalComment): Record<string, unknown> {
    return {
      [this.spec.incidentIdKeys[0]!]: incidentId,
      text: comment.text,
      authorId: comment.authorId,
      timestamp: comment.timestamp,
      source: "RC_BRIDGE",
    };
  }

  buildClosePayload(incidentId: string, status: "CLOSED" | "CANCELLED"): Record<string, unknown> {
    return { [this.spec.incidentIdKeys[0]!]: incidentId, status, closedAt: new Date().toISOString() };
  }

  getEndpoints(): CADAdapterEndpoints {
    return this.spec.endpoints;
  }

  normalizePriority(vendorPriority: unknown): IncidentPriority {
    const n = Number(vendorPriority);
    if (n >= 1 && n <= 5) return n as IncidentPriority;
    return 3;
  }

  normalizeStatus(vendorStatus: unknown): CadBridgeIncidentStatus {
    return this.spec.statusMap[String(vendorStatus ?? "").toUpperCase().trim()] ??
      this.spec.statusMap[String(vendorStatus ?? "").trim()] ??
      "ACTIVE";
  }

  normalizeUnitStatus(vendorStatus: unknown): UnitStatus {
    const key = String(vendorStatus ?? "").toUpperCase();
    if (key.includes("SCENE")) return "ONSCENE";
    if (key.includes("DISP")) return "DISPATCHED";
    if (key.includes("ENR")) return "ENROUTE";
    if (key.includes("AV")) return "AVAILABLE";
    return "UNAVAILABLE";
  }

  extractCreatedIncidentId(responseBody: Record<string, unknown>): string {
    const id = firstString(responseBody, this.spec.incidentIdKeys);
    if (!id) throw new AdapterParseError(this.vendor, "No incidentId in create response");
    return id;
  }

  private parseLocation(
    data: Record<string, unknown>,
    loc: Record<string, unknown>,
    payload: Record<string, unknown>,
  ): CanonicalLocation {
    const latRaw = loc[this.spec.latKeys[0]!] ?? data[this.spec.latKeys[0]!] ?? payload[this.spec.latKeys[0]!];
    const lonRaw = loc[this.spec.lonKeys[0]!] ?? data[this.spec.lonKeys[0]!] ?? payload[this.spec.lonKeys[0]!];
    return {
      address:
        firstString(loc, this.spec.addressKeys) ||
        firstString(data, this.spec.addressKeys) ||
        firstString(payload, this.spec.addressKeys),
      city: firstString(loc, ["city"]),
      state: firstString(loc, ["state"]),
      latitude: typeof latRaw === "number" ? latRaw : undefined,
      longitude: typeof lonRaw === "number" ? lonRaw : undefined,
    };
  }
}
