import { isValidIncidentTypeCode, type APCOIncidentTypeCode } from "../incident-types.js";

/** Preliminary SS native type → APCO mapping. Confirmed once SS publishes call-type docs. */
const SS_TO_APCO: Record<string, APCOIncidentTypeCode> = {
  MVA: "TC-MVC",
  MVC: "TC-MVC",
  CRASH: "TC-CRASH",
  PI: "TC-PI",
  HNR: "TC-HNR",
  FAT: "TC-FAT",
  FIRE: "FI-STRUC",
  STRUC: "FI-STRUC",
  VEHFIRE: "FI-VEH",
  EMS: "ME-UNK",
  MED: "ME-UNK",
  CHEST: "ME-CP",
  UNCON: "ME-UNC",
  OD: "ME-OD",
  TRAUMA: "ME-TRAUMA",
  HAZMAT: "HM-UNK",
  ASSAULT: "LA-ASLT",
  ROBBERY: "LA-ROB",
  BURG: "LA-BURG",
  SHOTS: "LA-SHOT",
  DOM: "LA-DOM",
};

export function mapSSIncidentType(ssType: string): APCOIncidentTypeCode | null {
  const trimmed = ssType.trim();
  if (!trimmed) return null;
  const upper = trimmed.toUpperCase();
  if (SS_TO_APCO[upper]) return SS_TO_APCO[upper];
  if (isValidIncidentTypeCode(trimmed)) return trimmed;
  return null;
}
