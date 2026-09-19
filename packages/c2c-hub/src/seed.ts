import { lookupIncidentType } from "@rc/common-codes";
import type { HubIncident } from "./types";

export const BERKELEY_COUNTY: import("./types").C2cAgency = {
  agencyId: "berkeley-county-sc",
  name: "Berkeley County Combined Dispatch",
  state: "SC",
  vendorId: "southern_software",
  issuingElementId: "berkeley-county-sc",
};

export const CHARLESTON_COUNTY: import("./types").C2cAgency = {
  agencyId: "charleston-county-sc",
  name: "Charleston County Consolidated 9-1-1",
  state: "SC",
  vendorId: "centralsquare",
  issuingElementId: "charleston-county-sc",
};

/** Rough Berkeley/Charleston line belt used for automatic aid. */
export const COUNTY_LINE_BOX = {
  minLat: 32.9,
  maxLat: 33.12,
  minLon: -80.15,
  maxLon: -79.9,
};

export const SEED_TRANSFER_RULES: import("./types").TransferRule[] = [
  {
    ruleId: "rule-fire-auto-aid",
    name: "Structure/vehicle fire automatic aid to Charleston County",
    enabled: true,
    sourceAgencyId: BERKELEY_COUNTY.agencyId,
    destAgencyId: CHARLESTON_COUNTY.agencyId,
    incidentTypeCodes: ["STRFIRE", "VEHFIRE", "HAZMAT"],
    geoBox: COUNTY_LINE_BOX,
  },
  {
    ruleId: "rule-mvc-injury",
    name: "Injury MVC mutual aid",
    enabled: true,
    sourceAgencyId: BERKELEY_COUNTY.agencyId,
    destAgencyId: CHARLESTON_COUNTY.agencyId,
    incidentTypeCodes: ["MVAINJ", "TRAUMA"],
    geoBox: COUNTY_LINE_BOX,
  },
  {
    ruleId: "rule-pursuit",
    name: "Pursuit entering Charleston County",
    enabled: true,
    sourceAgencyId: BERKELEY_COUNTY.agencyId,
    destAgencyId: CHARLESTON_COUNTY.agencyId,
    incidentTypeCodes: ["PURSUIT", "SHOTS"],
  },
  {
    ruleId: "rule-cardiac-intercept",
    name: "Cardiac intercept",
    enabled: true,
    sourceAgencyId: BERKELEY_COUNTY.agencyId,
    destAgencyId: CHARLESTON_COUNTY.agencyId,
    incidentTypeCodes: ["CARDIAC"],
    geoBox: COUNTY_LINE_BOX,
  },
];

function typed(callType: string, over: Omit<HubIncident, "commonIncidentTypeCode" | "incidentTypeLabel" | "cadCallType" | "sourceAgencyId" | "priority"> & { cadCallType?: string; priority?: number }): HubIncident {
  const row = lookupIncidentType(callType);
  if (!row) throw new Error(`Unknown demo call type: ${callType}`);
  return {
    sourceAgencyId: BERKELEY_COUNTY.agencyId,
    cadCallType: over.cadCallType ?? callType,
    commonIncidentTypeCode: row.code,
    incidentTypeLabel: row.label,
    priority: over.priority ?? row.defaultPriority,
    status: over.status,
    incidentId: over.incidentId,
    incidentNumber: over.incidentNumber,
    notes: over.notes,
    latitude: over.latitude,
    longitude: over.longitude,
    civicAddress: over.civicAddress,
    city: over.city,
    state: over.state ?? "SC",
    occurredAt: over.occurredAt,
  };
}

/** Simulated Berkeley County CAD incidents for the live mock hub. */
export function berkeleyDemoIncidents(now = "2026-09-18T15:10:00.000Z"): HubIncident[] {
  return [
    typed("STRUCTURE FIRE", {
      incidentId: "BKC-1001",
      incidentNumber: "BKC-1001",
      civicAddress: "412 County Line Rd",
      city: "Sangaree",
      latitude: 33.012,
      longitude: -80.041,
      notes: "Working fire, exposures on the Charleston County side of the line.",
      status: "active",
      occurredAt: now,
    }),
    typed("PI ACCIDENT", {
      incidentId: "BKC-1002",
      incidentNumber: "BKC-1002",
      civicAddress: "US-176 @ Jedburg Rd",
      city: "Jedburg",
      latitude: 33.055,
      longitude: -80.062,
      notes: "Two vehicle MVC, one trapped. Request Charleston medic.",
      status: "active",
      occurredAt: now,
    }),
    typed("PURSUIT", {
      incidentId: "BKC-1003",
      incidentNumber: "BKC-1003",
      civicAddress: "I-26 EB mm 205",
      city: "Summerville",
      latitude: 33.018,
      longitude: -80.175,
      notes: "Marked unit in pursuit, last direction Charleston County.",
      status: "active",
      occurredAt: now,
    }),
    typed("CARDIAC ARREST", {
      incidentId: "BKC-1004",
      incidentNumber: "BKC-1004",
      civicAddress: "88 Border Ln",
      city: "Ladson",
      latitude: 32.985,
      longitude: -80.108,
      notes: "CPR in progress. Closest ALS may be Charleston County.",
      status: "active",
      occurredAt: now,
    }),
    typed("TRAFFIC STOP", {
      incidentId: "BKC-1005",
      incidentNumber: "BKC-1005",
      civicAddress: "Main St @ Railroad Ave",
      city: "Moncks Corner",
      latitude: 33.196,
      longitude: -80.013,
      notes: "Routine stop — should NOT transfer.",
      status: "active",
      occurredAt: now,
    }),
  ];
}
