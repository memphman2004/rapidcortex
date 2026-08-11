import type { PsapProspect, PsapProspectContact } from "rapid-cortex-shared";
import { findContactsViaApollo } from "../rapid-iq/apollo-enrichment.js";
import {
  collectAgencyDomains,
  MAX_CONTACTS,
  mergeContacts,
} from "../rapid-iq/contact-enrichment-shared.js";
import { findContactsViaHunter } from "../rapid-iq/hunter-enrichment.js";
import { buildContactSearchTargets } from "../rapid-iq/agency-contact-finder.js";

const PSAP_PERSON_TITLES = [
  "911 director",
  "e911 director",
  "emergency communications director",
  "psap director",
  "communications director",
  "procurement officer",
  "procurement director",
  "it director",
  "county manager",
  "city manager",
];

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const STATE_DOMAIN_SLUGS: Record<string, string> = {
  AL: "alabama",
  AK: "alaska",
  AZ: "arizona",
  AR: "arkansas",
  CA: "california",
  CO: "colorado",
  CT: "connecticut",
  DE: "delaware",
  FL: "florida",
  GA: "georgia",
  HI: "hawaii",
  ID: "idaho",
  IL: "illinois",
  IN: "indiana",
  IA: "iowa",
  KS: "kansas",
  KY: "kentucky",
  LA: "louisiana",
  ME: "maine",
  MD: "maryland",
  MA: "massachusetts",
  MI: "michigan",
  MN: "minnesota",
  MS: "mississippi",
  MO: "missouri",
  MT: "montana",
  NE: "nebraska",
  NV: "nevada",
  NH: "newhampshire",
  NJ: "newjersey",
  NM: "newmexico",
  NY: "newyork",
  NC: "northcarolina",
  ND: "northdakota",
  OH: "ohio",
  OK: "oklahoma",
  OR: "oregon",
  PA: "pennsylvania",
  RI: "rhodeisland",
  SC: "southcarolina",
  SD: "southdakota",
  TN: "tennessee",
  TX: "texas",
  UT: "utah",
  VT: "vermont",
  VA: "virginia",
  WA: "washington",
  WV: "westvirginia",
  WI: "wisconsin",
  WY: "wyoming",
  DC: "dc",
};

/** Guess a .gov domain from agency name + state, e.g. Franklin County + OH → franklincountyohio.gov */
export function buildDomainFromName(agencyName: string, state: string): string | null {
  const slug = agencyName
    .toLowerCase()
    .replace(/\b(911|psap|e911|emergency|communications?|center|dispatch)\b/gi, " ")
    .replace(/\s+/g, "")
    .replace(/[^a-z0-9]/g, "");
  const stateCode = state.toUpperCase().replace(/[^A-Z]/g, "");
  const stateSlug = STATE_DOMAIN_SLUGS[stateCode] ?? state.toLowerCase().replace(/[^a-z]/g, "");
  if (!slug || !stateSlug) return null;
  return `${slug}${stateSlug}.gov`;
}

function candidateUrlsForProspect(prospect: PsapProspect): string[] {
  const fromWebsite = prospect.website?.trim() ? [prospect.website.trim()] : [];
  const guessedDomain = buildDomainFromName(prospect.psapName, prospect.state);
  const guessed = guessedDomain ? [`https://www.${guessedDomain}`, `https://${guessedDomain}`] : [];
  const targets = buildContactSearchTargets(
    prospect.psapName,
    prospect.city || prospect.county,
    prospect.state,
    "911",
    [...fromWebsite, ...guessed],
  );
  return targets.map((t) => t.url);
}

function mapSource(verificationSource: string | null | undefined): PsapProspectContact["source"] {
  const s = (verificationSource ?? "").toLowerCase();
  if (s.includes("hunter")) return "hunter";
  if (s.includes("apollo")) return "apollo";
  if (s.includes("directory") || s.includes("scrape") || s.includes("website")) return "directory";
  return "manual";
}

export function adaptRapidIqContactToPsap(
  c: Awaited<ReturnType<typeof findContactsViaHunter>>[number],
): PsapProspectContact {
  return {
    contactId: c.contactId,
    name: c.name,
    title: c.title,
    roleTier: c.roleTier,
    email: c.email,
    emailVerified: c.emailVerified,
    phone: c.phone,
    linkedInUrl: c.linkedInUrl,
    verificationStatus:
      c.verificationStatus === "verified"
        ? "verified"
        : c.verificationStatus === "predicted"
          ? "predicted"
          : "unverified",
    verificationSource: c.verificationSource ?? "enrichment",
    source: mapSource(c.verificationSource),
    addedAt: new Date().toISOString(),
  };
}

function dedupePsapContacts(contacts: PsapProspectContact[]): PsapProspectContact[] {
  const seen = new Set<string>();
  const out: PsapProspectContact[] = [];
  for (const c of contacts) {
    const email = (c.email ?? "").toLowerCase().trim();
    const key = email
      ? `email:${email}`
      : `name:${(c.name ?? "").toLowerCase()}|${c.title.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(c);
    if (out.length >= MAX_CONTACTS) break;
  }
  return out;
}

export type EnrichPsapContactsResult = {
  contacts: PsapProspectContact[];
  hunterCount: number;
  apolloCount: number;
  domains: string[];
};

/**
 * Hunter (.gov domain search) → Apollo (title gaps) for a PSAP prospect.
 * Does not scrape directories (PSAPs are curated; APIs first).
 */
export async function enrichPsapProspectContacts(
  prospect: PsapProspect,
): Promise<EnrichPsapContactsResult> {
  const candidateUrls = candidateUrlsForProspect(prospect);
  const enrichInput = {
    agencyName: prospect.psapName,
    city: prospect.city || prospect.county,
    state: prospect.state,
    vertical: "911" as const,
    candidateUrls,
  };

  // Prefer PSAP-specific titles for Apollo by temporarily not needing that —
  // apollo-enrichment uses PERSON_TITLES_BY_VERTICAL["911"] which is close enough.
  // Domain list for logging:
  const domains = collectAgencyDomains(candidateUrls);
  if (domains.length === 0) {
    const fallback = buildDomainFromName(prospect.psapName, prospect.state);
    if (fallback) domains.push(fallback);
  }

  const hunter = await findContactsViaHunter(enrichInput);
  let merged = hunter;
  if (merged.length < MAX_CONTACTS) {
    const apollo = await findContactsViaApollo({
      ...enrichInput,
      personTitles: PSAP_PERSON_TITLES,
      candidateUrls:
        domains.length > 0
          ? domains.map((d) => `https://${d}`)
          : enrichInput.candidateUrls,
    });
    merged = mergeContacts(merged, apollo);
  }

  const contacts = dedupePsapContacts(merged.map(adaptRapidIqContactToPsap));
  const hunterCount = contacts.filter((c) => c.source === "hunter").length;
  const apolloCount = contacts.filter((c) => c.source === "apollo").length;

  return { contacts, hunterCount, apolloCount, domains };
}

export async function enrichPsapProspectsInBatches(
  prospects: PsapProspect[],
  enrichOne: (p: PsapProspect) => Promise<unknown>,
  opts?: { batchSize?: number; pauseMs?: number },
): Promise<number> {
  const batchSize = opts?.batchSize ?? 5;
  const pauseMs = opts?.pauseMs ?? 2_000;
  let done = 0;
  for (let i = 0; i < prospects.length; i += batchSize) {
    const batch = prospects.slice(i, i + batchSize);
    await Promise.allSettled(batch.map((p) => enrichOne(p)));
    done += batch.length;
    if (i + batchSize < prospects.length) await sleep(pauseMs);
  }
  return done;
}
