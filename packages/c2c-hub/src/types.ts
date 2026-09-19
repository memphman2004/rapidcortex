import type { EidoDocument } from "@rc/eido";

export type C2cVendorId = "mock" | "southern_software" | "centralsquare";

export interface C2cAgency {
  agencyId: string;
  name: string;
  state: string;
  vendorId: C2cVendorId;
  /** IDX / issuing element id used on EIDO. */
  issuingElementId: string;
}

export interface GeoBox {
  minLat: number;
  maxLat: number;
  minLon: number;
  maxLon: number;
}

export interface TransferRule {
  ruleId: string;
  name: string;
  enabled: boolean;
  sourceAgencyId: string;
  destAgencyId: string;
  /** Hub common-codes; empty means any type. */
  incidentTypeCodes: string[];
  geoBox?: GeoBox;
}

export interface HubIncident {
  incidentId: string;
  incidentNumber: string;
  sourceAgencyId: string;
  cadCallType: string;
  commonIncidentTypeCode: string;
  incidentTypeLabel: string;
  priority: number;
  status: string;
  notes?: string;
  latitude?: number;
  longitude?: number;
  civicAddress?: string;
  city?: string;
  state?: string;
  occurredAt: string;
}

export interface TransferRecord {
  transferId: string;
  ruleId: string;
  fromAgencyId: string;
  toAgencyId: string;
  incidentId: string;
  eido: EidoDocument;
  deliveredAt: string;
}

export interface C2cCadAdapter {
  readonly vendorId: C2cVendorId;
  readonly agencyId: string;
  /** Pull or generate CAD incidents for the hub. */
  ingest(): HubIncident[];
  /** Accept an EIDO from the hub (neighbor CAD). */
  deliver(eido: EidoDocument, meta: { transferId: string; ruleId: string }): void;
  receivedTransfers(): TransferRecord[];
}
