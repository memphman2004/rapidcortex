/**
 * NENA-STA-021.1b-shaped Emergency Incident Data Object (JSON).
 * Practical subset used on the Rapid Cortex C2C hub. Not a claim of full schema
 * certification. Authoritative OpenAPI: https://github.com/NENA911/EIDO-JSON
 */

export const EIDO_TYPE = "EmergencyIncidentDataObject" as const;
export const EIDO_VERSION = "1.0";

export interface EidoRef {
  $ref: string;
}

export interface EidoComponentBase {
  $id: string;
  lastUpdateTimeStamp: string;
  updatedByAgencyReference?: EidoRef;
}

export interface EidoCallComponent extends EidoComponentBase {
  standardPrimaryCallType?: "emergency" | "nonEmergency" | "unknown";
  direction?: "incoming" | "outgoing" | "unknown";
  callStartTimestamp?: string;
  callStateRegistryText?: string;
  queueIdentifier?: string;
  locationReference?: EidoRef[];
  personReference?: EidoRef[];
}

export interface EidoAgencyComponent extends EidoComponentBase {
  agencyRoleDescriptionRegistryText?: string[];
  agencyType?: string[];
  agencyName?: string;
}

export interface EidoLocationComponent extends EidoComponentBase {
  locationTypeDescriptionRegistryText?: string;
  /** WGS-84 latitude when known (hub convenience; NENA also allows PIDF-LO by value). */
  latitude?: number;
  longitude?: number;
  civicAddress?: string;
  city?: string;
  state?: string;
  postalCode?: string;
}

/**
 * Hub incident component — maps CAD call type / priority onto the EIDO envelope
 * so receiving PSAPs can apply transfer rules without vendor CAD schemas.
 */
export interface EidoIncidentComponent extends EidoComponentBase {
  incidentNumber?: string;
  commonIncidentTypeCode?: string;
  incidentTypeLabel?: string;
  priority?: number;
  status?: string;
  notes?: string;
  locationReference?: EidoRef[];
}

export interface EidoDocument {
  $id: string;
  eidoVersion: string;
  lastUpdateTimeStamp: string;
  issuingElementIdentification: string;
  callComponent?: EidoCallComponent[];
  agencyComponent?: EidoAgencyComponent[];
  locationComponent?: EidoLocationComponent[];
  incidentComponent?: EidoIncidentComponent[];
  "@context"?: { "@vocab": string };
}

export interface HubIncidentInput {
  incidentId: string;
  incidentNumber?: string;
  agencyId: string;
  agencyName?: string;
  commonIncidentTypeCode: string;
  incidentTypeLabel: string;
  priority: number;
  status?: string;
  notes?: string;
  latitude?: number;
  longitude?: number;
  civicAddress?: string;
  city?: string;
  state?: string;
  occurredAt: string;
}

export interface EidoValidationError {
  path: string;
  message: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export function validateEido(doc: unknown): EidoValidationError[] {
  const errors: EidoValidationError[] = [];
  if (!isRecord(doc)) {
    return [{ path: "$", message: "EIDO must be a JSON object" }];
  }
  if (!isNonEmptyString(doc.$id)) errors.push({ path: "$id", message: "required URN/id" });
  if (!isNonEmptyString(doc.eidoVersion)) errors.push({ path: "eidoVersion", message: "required" });
  if (!isNonEmptyString(doc.lastUpdateTimeStamp)) {
    errors.push({ path: "lastUpdateTimeStamp", message: "required ISO-8601 timestamp" });
  }
  if (!isNonEmptyString(doc.issuingElementIdentification)) {
    errors.push({ path: "issuingElementIdentification", message: "required issuing element" });
  }
  return errors;
}

export function parseEido(raw: unknown): EidoDocument {
  const errors = validateEido(raw);
  if (errors.length) {
    throw new Error(`Invalid EIDO: ${errors.map((e) => `${e.path}: ${e.message}`).join("; ")}`);
  }
  return raw as EidoDocument;
}

export function buildEido(input: HubIncidentInput): EidoDocument {
  const now = input.occurredAt;
  const locationId = `urn:emergency:uid:location:${input.incidentId}`;
  const agencyId = input.agencyId;
  const loc: EidoLocationComponent = {
    $id: locationId,
    lastUpdateTimeStamp: now,
    updatedByAgencyReference: { $ref: agencyId },
    locationTypeDescriptionRegistryText: "Caller",
    latitude: input.latitude,
    longitude: input.longitude,
    civicAddress: input.civicAddress,
    city: input.city,
    state: input.state,
  };
  return {
    $id: `urn:emergency:uid:incidentid:${input.incidentId}:${agencyId}`,
    eidoVersion: EIDO_VERSION,
    lastUpdateTimeStamp: now,
    issuingElementIdentification: agencyId,
    agencyComponent: [
      {
        $id: agencyId,
        lastUpdateTimeStamp: now,
        agencyRoleDescriptionRegistryText: ["CallReceiving"],
        agencyType: ["psap"],
        agencyName: input.agencyName,
      },
    ],
    callComponent: [
      {
        $id: `urn:emergency:uid:callid:${input.incidentId}:${agencyId}`,
        lastUpdateTimeStamp: now,
        updatedByAgencyReference: { $ref: agencyId },
        standardPrimaryCallType: "emergency",
        direction: "incoming",
        callStartTimestamp: now,
        callStateRegistryText: "callAnswered",
        locationReference: [{ $ref: locationId }],
      },
    ],
    locationComponent: [loc],
    incidentComponent: [
      {
        $id: `urn:emergency:uid:incident:${input.incidentId}`,
        lastUpdateTimeStamp: now,
        updatedByAgencyReference: { $ref: agencyId },
        incidentNumber: input.incidentNumber ?? input.incidentId,
        commonIncidentTypeCode: input.commonIncidentTypeCode,
        incidentTypeLabel: input.incidentTypeLabel,
        priority: input.priority,
        status: input.status ?? "active",
        notes: input.notes,
        locationReference: [{ $ref: locationId }],
      },
    ],
    "@context": { "@vocab": "./JSON-LD_Contexts/EmergencyIncidentDataObjectType.jsonld" },
  };
}

export function incidentFromEido(doc: EidoDocument): {
  incidentId: string;
  commonIncidentTypeCode?: string;
  incidentTypeLabel?: string;
  priority?: number;
  agencyId: string;
  latitude?: number;
  longitude?: number;
  civicAddress?: string;
} {
  const incident = doc.incidentComponent?.[0];
  const location = doc.locationComponent?.[0];
  return {
    incidentId: incident?.incidentNumber ?? doc.$id,
    commonIncidentTypeCode: incident?.commonIncidentTypeCode,
    incidentTypeLabel: incident?.incidentTypeLabel,
    priority: incident?.priority,
    agencyId: doc.issuingElementIdentification,
    latitude: location?.latitude,
    longitude: location?.longitude,
    civicAddress: location?.civicAddress,
  };
}
