import type { RapidIqContact, RapidIqVertical } from "rapid-cortex-shared";

export const TITLE_KEYWORDS = [
  "911",
  "dispatch",
  "communications",
  "emergency",
  "ems",
  "fire",
  "police",
  "public safety",
  "cad",
  "ng911",
  "procurement",
  "purchasing",
  "county manager",
  "city manager",
  "director",
  "chief",
  "coordinator",
  "sheriff",
  "campus safety",
  "security",
];

/** Titles used for Apollo people search (and Hunter relevance filtering). */
export const PERSON_TITLES_BY_VERTICAL: Record<RapidIqVertical, string[]> = {
  "911": [
    "911 director",
    "emergency communications director",
    "communications director",
    "procurement officer",
    "public safety director",
    "EMS director",
    "county manager",
    "city manager",
  ],
  campus: [
    "campus police chief",
    "director of public safety",
    "campus safety director",
    "chief of police",
    "procurement officer",
  ],
  venue: ["director of security", "security director", "venue operations director", "procurement"],
  transit: [
    "transit police chief",
    "director of security",
    "chief of police",
    "emergency management",
    "procurement officer",
    "CIO",
  ],
};

export const MAX_CONTACTS = 5;

export type ContactProviderTrace = {
  provider: "hunter" | "apollo";
  domain: string;
  httpStatus: number;
  rawHits: number;
  kept: number;
  droppedByTitle?: number;
  droppedByConfidence?: number;
  error?: string;
};

export type ContactProviderResult = {
  contacts: Omit<RapidIqContact, "opportunityId">[];
  traces: ContactProviderTrace[];
};

export type ContactEnrichInput = {
  agencyName: string;
  city: string;
  state: string;
  vertical: RapidIqVertical;
  candidateUrls?: string[];
  /** Optional Apollo title overrides (e.g. PSAP-specific titles). */
  personTitles?: string[];
};

export function extractDomainFromUrl(url: string): string | null {
  try {
    const host = new URL(url.includes("://") ? url : `https://${url}`).hostname.toLowerCase();
    if (!host || host === "localhost") return null;
    return host.replace(/^www\./, "");
  } catch {
    return null;
  }
}

/**
 * Prefer .gov / .edu agency domains (best for Hunter on government/campus).
 * Falls back to other agency hostnames; skips grant portals / social.
 */
export function collectAgencyDomains(candidateUrls: string[] = []): string[] {
  const govEdu: string[] = [];
  const other: string[] = [];
  const seen = new Set<string>();

  for (const raw of candidateUrls) {
    const domain = extractDomainFromUrl(raw);
    if (!domain || seen.has(domain)) continue;
    if (
      /\b(grants\.gov|sam\.gov|facebook\.com|linkedin\.com|twitter\.com|x\.com|youtube\.com|apollo\.io|hunter\.io)\b/i.test(
        domain,
      )
    ) {
      continue;
    }
    seen.add(domain);
    if (/\.(gov|edu)(\.|$)/i.test(domain) || domain.endsWith(".gov") || domain.endsWith(".edu")) {
      govEdu.push(domain);
    } else {
      other.push(domain);
    }
  }

  return [...govEdu.slice(0, 3), ...other.slice(0, 2)];
}

/** @deprecated alias — prefer collectAgencyDomains */
export const collectHunterDomains = collectAgencyDomains;

export function isPublicSafetyRelevantTitle(title: string | null | undefined): boolean {
  const t = (title ?? "").toLowerCase();
  if (!t.trim()) return false;
  return TITLE_KEYWORDS.some((k) => t.includes(k));
}

export function inferRoleTier(title: string): RapidIqContact["roleTier"] {
  const t = title.toLowerCase();
  if (/\b(procurement|purchasing|buyer)\b/.test(t)) return "procurement";
  if (/\b(county manager|city manager|executive|ceo|county administrator)\b/.test(t)) {
    return "executive";
  }
  if (/\b(deputy|assistant|coordinator|supervisor|lieutenant)\b/.test(t)) return "secondary";
  return "primary";
}

export function contactDedupeKey(c: Pick<RapidIqContact, "name" | "title" | "email">): string {
  const email = (c.email ?? "").toLowerCase().trim();
  if (email) return `email:${email}`;
  return `name:${(c.name ?? "").toLowerCase()}|${(c.title ?? "").toLowerCase()}`;
}

export function mergeContacts(
  base: Omit<RapidIqContact, "opportunityId">[],
  incoming: Omit<RapidIqContact, "opportunityId">[],
  limit = MAX_CONTACTS,
): Omit<RapidIqContact, "opportunityId">[] {
  const merged = [...base];
  const seen = new Set(merged.map((c) => contactDedupeKey(c)));

  for (const d of incoming) {
    if (merged.length >= limit) break;
    const key = contactDedupeKey(d);
    if (seen.has(key)) continue;

    const nameKey = (d.name ?? "").toLowerCase();
    const idx = nameKey
      ? merged.findIndex((c) => !c.email && (c.name ?? "").toLowerCase() === nameKey)
      : -1;
    if (idx >= 0 && d.email) {
      const cur = merged[idx]!;
      merged[idx] = {
        ...cur,
        email: d.email,
        emailVerified: d.emailVerified || cur.emailVerified,
        phone: cur.phone ?? d.phone,
        linkedInUrl: cur.linkedInUrl ?? d.linkedInUrl,
        verificationSource: d.verificationSource ?? cur.verificationSource,
        verificationStatus: "verified",
        verifiedAt: new Date().toISOString(),
      };
      seen.add(contactDedupeKey(merged[idx]!));
      continue;
    }

    seen.add(key);
    merged.push(d);
  }

  return merged.slice(0, limit);
}
