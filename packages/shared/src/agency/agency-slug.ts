/**
 * US state name → 2-letter abbreviation lookup.
 * Accepts full name (case-insensitive) or abbreviation.
 */
const STATE_MAP: Record<string, string> = {
  alabama: "al",
  alaska: "ak",
  arizona: "az",
  arkansas: "ar",
  california: "ca",
  colorado: "co",
  connecticut: "ct",
  delaware: "de",
  florida: "fl",
  georgia: "ga",
  hawaii: "hi",
  idaho: "id",
  illinois: "il",
  indiana: "in",
  iowa: "ia",
  kansas: "ks",
  kentucky: "ky",
  louisiana: "la",
  maine: "me",
  maryland: "md",
  massachusetts: "ma",
  michigan: "mi",
  minnesota: "mn",
  mississippi: "ms",
  missouri: "mo",
  montana: "mt",
  nebraska: "ne",
  nevada: "nv",
  "new hampshire": "nh",
  "new jersey": "nj",
  "new mexico": "nm",
  "new york": "ny",
  "north carolina": "nc",
  "north dakota": "nd",
  ohio: "oh",
  oklahoma: "ok",
  oregon: "or",
  pennsylvania: "pa",
  "rhode island": "ri",
  "south carolina": "sc",
  "south dakota": "sd",
  tennessee: "tn",
  texas: "tx",
  utah: "ut",
  vermont: "vt",
  virginia: "va",
  washington: "wa",
  "west virginia": "wv",
  wisconsin: "wi",
  wyoming: "wy",
  "district of columbia": "dc",
  "washington dc": "dc",
  "puerto rico": "pr",
  guam: "gu",
};

/**
 * Normalize city segment (and generic text): lowercase, & → and, strip non-alphanumeric.
 */
function normalizeSegment(value: string): string {
  return value
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]/g, "");
}

/**
 * Center/agency name normalization with dispatch-specific abbreviations.
 */
function normalizeCenterSegment(value: string): string {
  let s = value.toLowerCase().replace(/&/g, "and");
  s = s.replace(/\bcounty\b(?=\s*[\d])/gi, " ");
  s = s.replace(/\bco\.?\b/gi, " ");
  s = s.replace(/\bcommunications\b/gi, "comm");
  s = s.replace(/\bdepartment\b/gi, "dept");
  s = s.replace(/\bdivision\b/gi, "div");
  return s.replace(/[^a-z0-9]/g, "");
}

/**
 * Resolve state input (full name or abbreviation) to 2-letter code.
 * Returns null if unrecognized.
 */
function resolveState(input: string): string | null {
  const lower = input.trim().toLowerCase();
  if (/^[a-z]{2}$/.test(lower)) {
    const values = Object.values(STATE_MAP);
    if (values.includes(lower)) return lower;
  }
  return STATE_MAP[lower] ?? null;
}

export interface AgencySlugInput {
  state: string;
  city: string;
  centerName: string;
}

export interface AgencySlugResult {
  slug: string;
  stateCode: string;
  citySegment: string;
  centerSegment: string;
}

/**
 * Build a canonical agency ID slug from state + city + center name.
 *
 * Format: `{state}-{city}-{centername}`
 * Example: ga-columbus-muscogee911
 */
export function buildAgencySlug(input: AgencySlugInput): AgencySlugResult {
  const stateCode = resolveState(input.state);
  if (!stateCode) {
    throw new Error(`Unrecognized state: "${input.state}"`);
  }

  const citySegment = normalizeSegment(input.city);
  if (!citySegment) {
    throw new Error("City/county name cannot be empty after normalization.");
  }

  let centerSegment = normalizeCenterSegment(input.centerName);
  if (!centerSegment) {
    throw new Error("Center name cannot be empty after normalization.");
  }

  const MAX_TOTAL = 60;
  const fixedLen = 2 + 1 + citySegment.length + 1;
  const maxCenterLen = MAX_TOTAL - fixedLen;
  if (centerSegment.length > maxCenterLen) {
    centerSegment = centerSegment.slice(0, maxCenterLen);
  }

  const slug = `${stateCode}-${citySegment}-${centerSegment}`;

  return { slug, stateCode, citySegment, centerSegment };
}

/**
 * Resolve a collision-safe slug given a set of already-existing slugs.
 * Appends numeric suffix directly to the center segment: muscogee9112, muscogee9113, etc.
 */
export function resolveUniqueAgencySlug(
  input: AgencySlugInput,
  existingSlugs: Set<string>,
): string {
  const { slug, stateCode, citySegment, centerSegment } = buildAgencySlug(input);

  if (!existingSlugs.has(slug)) return slug;

  for (let i = 2; i <= 99; i++) {
    const candidate = `${stateCode}-${citySegment}-${centerSegment}${i}`;
    if (!existingSlugs.has(candidate)) return candidate;
  }

  return `${stateCode}-${citySegment}-${centerSegment}${Date.now().toString(36)}`;
}
