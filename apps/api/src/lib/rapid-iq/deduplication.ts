/** Stable opportunity key from agency + state for upsert dedupe. */
export function opportunityDedupeKey(agencyName: string, state: string): string {
  const slug = agencyName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 64);
  return `opp#${String(state).toUpperCase()}#${slug}`;
}

/**
 * Strip locale/tracking query noise so the same agenda page with
 * `?oc_lang=en-US` / `?oc_lang=es` collapses to one source.
 */
export function normalizeSourceUrl(url: string): string {
  try {
    const u = new URL(url.trim());
    const dropExact = new Set(["oc_lang", "lang", "locale", "hl", "language"]);
    for (const key of [...u.searchParams.keys()]) {
      const lower = key.toLowerCase();
      if (dropExact.has(lower) || lower.startsWith("utm_")) {
        u.searchParams.delete(key);
      }
    }
    u.hash = "";
    if (u.pathname.length > 1 && u.pathname.endsWith("/")) {
      u.pathname = u.pathname.slice(0, -1);
    }
    return u.toString();
  } catch {
    return url.trim();
  }
}

export function signalDedupeKey(opportunityId: string, sourceUrl: string, title: string): string {
  const t = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 48);
  const u = normalizeSourceUrl(sourceUrl).toLowerCase().replace(/[^a-z0-9]+/g, "").slice(-32);
  return `sig#${opportunityId}#${u}#${t}`;
}

/** Keep first source per normalized URL; prefer primary role when present. */
export function dedupeSourcesByUrl<T extends { url: string; sourceRole?: string }>(sources: T[]): T[] {
  const byUrl = new Map<string, T>();
  for (const s of sources) {
    const key = normalizeSourceUrl(s.url).toLowerCase();
    const existing = byUrl.get(key);
    if (!existing) {
      byUrl.set(key, s);
      continue;
    }
    if (s.sourceRole === "primary" && existing.sourceRole !== "primary") {
      byUrl.set(key, s);
    }
  }
  return [...byUrl.values()];
}

/** Collector / platform names that must never be stored as agencyName. */
export const SOURCE_NAMES_NOT_AGENCIES = [
  "grants.gov",
  "sam.gov",
  "ntia",
  "fema",
  "usac",
  "legiscan",
  "openlegislature",
  "chronicle of higher education",
  "campus safety magazine",
  "iaclea",
  "apco",
  "nena",
  "fema bric",
  "hmgp",
];

export type AgencySourceValidation = {
  ok: boolean;
  reason?: string;
};

/**
 * Reject signals where the classifier/collector used the data source as the agency.
 */
export function validateAgencyIsNotSource(
  agencyName: string | null | undefined,
  sourceName: string | null | undefined,
  opts?: { city?: string | null; county?: string | null },
): AgencySourceValidation {
  const agencyLower = (agencyName ?? "").toLowerCase().trim();
  const sourceLower = (sourceName ?? "").toLowerCase().trim();

  if (!agencyLower) {
    return { ok: false, reason: "missing_agency_name" };
  }

  if (sourceLower && agencyLower === sourceLower) {
    return { ok: false, reason: "agency_is_source" };
  }

  if (SOURCE_NAMES_NOT_AGENCIES.some((s) => agencyLower.includes(s))) {
    return { ok: false, reason: "agency_is_known_source" };
  }

  // State program / coordinator offices without a city/county are not buyers
  const countyLower = (opts?.county ?? "").toLowerCase().trim();
  const cityTrim = opts?.city?.trim() ?? "";
  const looksLikeProgram =
    agencyLower.endsWith(" program") ||
    agencyLower.includes("911 program") ||
    agencyLower.includes(" e911") ||
    agencyLower.includes(" csec");
  if (looksLikeProgram && !cityTrim && (!countyLower || countyLower === agencyLower)) {
    return { ok: false, reason: "agency_name_is_program_without_location" };
  }

  return { ok: true };
}

/** Detect the known boilerplate classifier / heuristic summary. */
export function isTemplateSummary(summary: string | null | undefined): boolean {
  const s = (summary ?? "").toLowerCase();
  if (!s.trim()) return true;
  const templateMarkers = [
    "the meeting materials from",
    "under active review",
    "ai-assisted dispatch tooling",
    "discussing public safety technology investment",
  ];
  const hits = templateMarkers.filter((m) => s.includes(m)).length;
  return hits >= 2;
}
