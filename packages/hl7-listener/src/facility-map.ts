import { hl7FacilityMapSchema, type Hl7FacilityMap, type Hl7FacilityMappingEntry } from "rapid-cortex-shared";

const DEFAULT_MAP: Hl7FacilityMap = {
  SARASOTA_MEM: {
    agencyId: "demo-agency",
    hospitalId: "demo-hosp-memorial",
    bedTotals: { er: 25, icu: 12, trauma: 4 },
  },
  ST_JOSEPH: {
    agencyId: "demo-agency",
    hospitalId: "demo-hosp-st-joseph",
    bedTotals: { er: 20, icu: 8, trauma: 2 },
  },
  CITY_HOSPITAL: {
    agencyId: "demo-agency",
    hospitalId: "demo-hosp-city",
    bedTotals: { er: 18, icu: 6, trauma: 0 },
  },
};

export function loadFacilityMap(): Hl7FacilityMap {
  const raw = process.env.HL7_FACILITY_MAP_JSON?.trim();
  if (!raw) return DEFAULT_MAP;
  try {
    const parsed = hl7FacilityMapSchema.parse(JSON.parse(raw));
    return parsed;
  } catch (e) {
    console.error("[hl7] invalid HL7_FACILITY_MAP_JSON, using defaults", e);
    return DEFAULT_MAP;
  }
}

export function resolveFacility(
  map: Hl7FacilityMap,
  sendingFacility: string,
): Hl7FacilityMappingEntry | null {
  const key = sendingFacility.trim().toUpperCase();
  return map[key] ?? map[sendingFacility] ?? null;
}
