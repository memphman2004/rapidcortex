import type { RegionColorIndex } from "./region-colors";

/**
 * Pre-computed 4-color assignment for US states + DC.
 * Generated with degree-ordered greedy coloring on the continental adjacency graph.
 * Colors: 0=blue, 1=amber, 2=emerald, 3=violet
 */
export const US_STATE_COLOR_INDEX: Record<string, RegionColorIndex> = {
  AK: 0,
  AL: 2,
  AR: 2,
  AZ: 2,
  CA: 0,
  CO: 0,
  CT: 2,
  DC: 2,
  DE: 2,
  FL: 1,
  GA: 0,
  HI: 0,
  IA: 1,
  ID: 0,
  IL: 3,
  IN: 0,
  KS: 3,
  KY: 2,
  LA: 1,
  MA: 0,
  MD: 1,
  ME: 0,
  MI: 2,
  MN: 2,
  MO: 0,
  MS: 0,
  MT: 1,
  NC: 2,
  ND: 3,
  NE: 2,
  NH: 1,
  NJ: 3,
  NM: 3,
  NV: 3,
  NY: 1,
  OH: 1,
  OK: 1,
  OR: 1,
  PA: 0,
  RI: 1,
  SC: 1,
  SD: 0,
  TN: 1,
  TX: 0,
  UT: 1,
  VA: 0,
  VT: 2,
  WA: 2,
  WI: 0,
  WV: 3,
  WY: 3,
};

/** FIPS → color when GeoJSON uses numeric state FIPS (`STATEFP` / feature `id`). */
export const US_FIPS_COLOR_INDEX: Record<string, RegionColorIndex> = {
  "01": 2, // AL
  "02": 0, // AK
  "04": 2, // AZ
  "05": 2, // AR
  "06": 0, // CA
  "08": 0, // CO
  "09": 2, // CT
  "10": 2, // DE
  "11": 2, // DC
  "12": 1, // FL
  "13": 0, // GA
  "15": 0, // HI
  "16": 0, // ID
  "17": 3, // IL
  "18": 0, // IN
  "19": 1, // IA
  "20": 3, // KS
  "21": 2, // KY
  "22": 1, // LA
  "23": 0, // ME
  "24": 1, // MD
  "25": 0, // MA
  "26": 2, // MI
  "27": 2, // MN
  "28": 0, // MS
  "29": 0, // MO
  "30": 1, // MT
  "31": 2, // NE
  "32": 3, // NV
  "33": 1, // NH
  "34": 3, // NJ
  "35": 3, // NM
  "36": 1, // NY
  "37": 2, // NC
  "38": 3, // ND
  "39": 1, // OH
  "40": 1, // OK
  "41": 1, // OR
  "42": 0, // PA
  "44": 1, // RI
  "45": 1, // SC
  "46": 0, // SD
  "47": 1, // TN
  "48": 0, // TX
  "49": 1, // UT
  "50": 2, // VT
  "51": 0, // VA
  "53": 2, // WA
  "54": 3, // WV
  "55": 0, // WI
  "56": 3, // WY
};

const STATE_NAME_TO_ABBR: Record<string, string> = {
  alabama: "AL",
  alaska: "AK",
  arizona: "AZ",
  arkansas: "AR",
  california: "CA",
  colorado: "CO",
  connecticut: "CT",
  delaware: "DE",
  "district of columbia": "DC",
  florida: "FL",
  georgia: "GA",
  hawaii: "HI",
  idaho: "ID",
  illinois: "IL",
  indiana: "IN",
  iowa: "IA",
  kansas: "KS",
  kentucky: "KY",
  louisiana: "LA",
  maine: "ME",
  maryland: "MD",
  massachusetts: "MA",
  michigan: "MI",
  minnesota: "MN",
  mississippi: "MS",
  missouri: "MO",
  montana: "MT",
  nebraska: "NE",
  nevada: "NV",
  "new hampshire": "NH",
  "new jersey": "NJ",
  "new mexico": "NM",
  "new york": "NY",
  "north carolina": "NC",
  "north dakota": "ND",
  ohio: "OH",
  oklahoma: "OK",
  oregon: "OR",
  pennsylvania: "PA",
  "rhode island": "RI",
  "south carolina": "SC",
  "south dakota": "SD",
  tennessee: "TN",
  texas: "TX",
  utah: "UT",
  vermont: "VT",
  virginia: "VA",
  washington: "WA",
  "west virginia": "WV",
  wisconsin: "WI",
  wyoming: "WY",
};

/** Normalize agency `state` field (abbrev or full name) to STUSPS. */
export function normalizeUsStateKey(raw: string | undefined | null): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const upper = trimmed.toUpperCase();
  if (upper.length === 2 && upper in US_STATE_COLOR_INDEX) return upper;
  const fromName = STATE_NAME_TO_ABBR[trimmed.toLowerCase()];
  return fromName ?? null;
}
