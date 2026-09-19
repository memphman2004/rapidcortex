import { isValidIncidentTypeCode, type APCOIncidentTypeCode } from "../incident-types.js";

/** Preliminary CentralSquare call-type → APCO mapping. Confirmed once CS publishes codes. */
const CS_TO_APCO: Record<string, APCOIncidentTypeCode> = {
  MVC: "TC-MVC",
  MVA: "TC-MVC",
  CRASH: "TC-CRASH",
  PIACC: "TC-PI",
  HITRUN: "TC-HNR",
  FATAL: "TC-FAT",
  FIRESTR: "FI-STRUC",
  FIREVEH: "FI-VEH",
  MED: "ME-UNK",
  CARDIAC: "ME-CARDIAC",
  STROKE: "ME-STROKE",
  HAZMAT: "HM-UNK",
  ASLT: "LA-ASLT",
  ROB: "LA-ROB",
};

export function mapCSIncidentType(csType: string): APCOIncidentTypeCode | null {
  const trimmed = csType.trim();
  if (!trimmed) return null;
  const upper = trimmed.toUpperCase();
  if (CS_TO_APCO[upper]) return CS_TO_APCO[upper];
  if (isValidIncidentTypeCode(trimmed)) return trimmed;
  return null;
}
