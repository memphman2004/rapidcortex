import { ALL_SLOT_TYPES } from "./slot-types.js";

/** Noun-phrase / department labels that beat the first Lex synonym for spoken copy. */
const OVERRIDES: Record<string, string> = {
  FALLEN_TREE_ROAD: "fallen tree in the road",
  FALLEN_TREE_SIDEWALK: "fallen tree on the sidewalk",
  DOWNED_BRANCH: "downed branch",
  HAPPENING_NOW: "happening right now",
  ONGOING_CHRONIC: "an ongoing problem",
  ALREADY_HAPPENED: "already happened",
  UNCERTAIN: "not sure",
  POTHOLE: "pothole",
  SINKHOLE: "sinkhole",
  PUBLIC_WORKS: "Public Works",
  PUBLIC_WORKS_ELECTRICAL: "Public Works Electrical",
  URBAN_FORESTRY: "Urban Forestry",
  SANITATION: "Sanitation",
  WATER_SEWER_AUTHORITY: "the Water Authority",
  PARKS_RECREATION: "Parks and Recreation",
  PARKING_ENFORCEMENT: "Parking Enforcement",
  ANIMAL_CONTROL: "Animal Control",
  CODE_ENFORCEMENT: "Code Enforcement",
  POLICE_NON_EMERGENCY: "non-emergency police",
  FIRE_MARSHAL_NON_EMERGENCY: "the Fire Marshal",
  TRANSIT_AUTHORITY: "Transit",
  ENVIRONMENTAL_QUALITY: "Environmental Quality",
  SOCIAL_SERVICES: "Social Services",
  HOUSING_COMMUNITY_DEV: "Housing",
  CITY_CLERK: "the City Clerk",
  THREE11_OPERATIONS: "311",
};

function fromSlotTypes(): Record<string, string> {
  const out: Record<string, string> = { ...OVERRIDES };
  for (const st of ALL_SLOT_TYPES) {
    for (const entry of st.values) {
      if (out[entry.value]) continue;
      const spoken = entry.synonyms?.[0]?.trim();
      if (spoken) out[entry.value] = spoken;
    }
  }
  return out;
}

export const SLOT_VALUE_LABELS: Record<string, string> = fromSlotTypes();

export function conversationalSlotValue(value: string | null | undefined): string {
  const raw = (value ?? "").trim();
  if (!raw) return "";
  if (SLOT_VALUE_LABELS[raw]) return SLOT_VALUE_LABELS[raw];
  const upper = raw.toUpperCase();
  if (SLOT_VALUE_LABELS[upper]) return SLOT_VALUE_LABELS[upper];
  if (!/[A-Z][a-z]+[A-Z]/.test(raw) && !raw.includes("_")) return raw;
  return raw
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .toLowerCase()
    .replace(/\bca\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
