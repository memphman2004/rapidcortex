/** Vendor-neutral CAD read models shared by adapters (Tyler, Motorola, Hexagon, etc.). */

export type CadIncidentRecord = {
  incidentId: string;
  externalCadId: string;
  agencyId: string;
  callType: string;
  priority: string;
  status: string;
  address: string;
  latitude: number;
  longitude: number;
  callerName?: string;
  callerPhone?: string;
  createdAt: string;
  updatedAt: string;
  assignedUnits: readonly string[];
  notes: readonly string[];
  sourceVendor: string;
};

export type CadUnitRecord = {
  unitId: string;
  externalCadUnitId: string;
  agencyId: string;
  unitType: string;
  status: string;
  currentIncidentId?: string;
  latitude?: number;
  longitude?: number;
  updatedAt: string;
  /** Populated when the adapter echoes vendor lineage (optional for interoperability). */
  sourceVendor?: string;
};

export type CadEventPayload = Record<string, unknown>;

export type CadEventRecord = {
  eventId: string;
  agencyId: string;
  externalCadId: string;
  eventType: string;
  payload: CadEventPayload;
  receivedAt: string;
  sourceVendor: string;
};
