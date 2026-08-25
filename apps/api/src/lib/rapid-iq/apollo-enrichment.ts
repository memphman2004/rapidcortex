import { randomUUID } from "node:crypto";
import type { RapidIqContact } from "rapid-cortex-shared";
import { resolvePlainOrSecretArn } from "../runtimeSecrets.js";
import { isExplicitCollectorsMockEnabled } from "./agenda-finder.js";
import {
  collectAgencyDomains,
  type ContactEnrichInput,
  type ContactProviderResult,
  type ContactProviderTrace,
  inferRoleTier,
  isPublicSafetyRelevantTitle,
  MAX_CONTACTS,
  PERSON_TITLES_BY_VERTICAL,
} from "./contact-enrichment-shared.js";

type ApolloPerson = {
  id?: string;
  first_name?: string | null;
  last_name?: string | null;
  name?: string | null;
  title?: string | null;
  email?: string | null;
  email_status?: string | null;
  linkedin_url?: string | null;
  phone_numbers?: Array<{ sanitized_number?: string | null; raw_number?: string | null }>;
  organization?: { primary_domain?: string | null } | null;
};

type ApolloSearchResponse = {
  people?: ApolloPerson[];
};

async function resolveApolloApiKey(): Promise<string> {
  return resolvePlainOrSecretArn(
    process.env.RAPID_IQ_APOLLO_API_KEY,
    process.env.RAPID_IQ_APOLLO_API_KEY_SECRET_ARN,
    { preferredField: "apiKey" },
  );
}

function fullName(person: ApolloPerson): string | null {
  if (person.name?.trim()) return person.name.trim();
  const name = [person.first_name?.trim(), person.last_name?.trim()].filter(Boolean).join(" ").trim();
  return name || null;
}

function mapApolloPerson(
  person: ApolloPerson,
  domain: string | null,
): Omit<RapidIqContact, "opportunityId"> | null {
  const title = (person.title?.trim() || "Public safety contact").slice(0, 120);
  if (person.title && !isPublicSafetyRelevantTitle(person.title)) return null;

  const email = person.email?.trim().toLowerCase() || null;
  const name = fullName(person);
  if (!name && !email) return null;

  return {
    contactId: randomUUID(),
    name,
    title,
    roleTier: inferRoleTier(title),
    matchType: name ? "exact" : "related",
    matchedOn: title,
    verificationStatus: email || name ? "verified" : "predicted",
    verificationSource: "Apollo.io",
    sourceCount: 1,
    verifiedAt: email || name ? new Date().toISOString() : null,
    sourceUrl: domain ? `https://${domain}` : "https://www.apollo.io",
    email,
    emailVerified: person.email_status === "verified" || Boolean(email),
    phone:
      person.phone_numbers?.[0]?.sanitized_number?.trim() ||
      person.phone_numbers?.[0]?.raw_number?.trim() ||
      null,
    linkedInUrl: person.linkedin_url?.trim() || null,
  };
}

/**
 * Stage 2: Apollo.io people search by org domain + public-safety titles.
 * Key must be in X-Api-Key header — never as a query param.
 */
export async function hasApolloApiKey(): Promise<boolean> {
  if (isExplicitCollectorsMockEnabled()) return false;
  return Boolean(await resolveApolloApiKey());
}

/** Current docs: People API Search is mixed_people/api_search (or a master key). */
const APOLLO_SEARCH_URLS = [
  "https://api.apollo.io/api/v1/mixed_people/api_search",
  "https://api.apollo.io/api/v1/mixed_people/search",
  "https://api.apollo.io/v1/mixed_people/api_search",
  "https://api.apollo.io/v1/mixed_people/search",
];

export async function findContactsViaApollo(
  input: ContactEnrichInput,
): Promise<ContactProviderResult> {
  if (isExplicitCollectorsMockEnabled()) {
    return {
      contacts: [],
      traces: [{ provider: "apollo", domain: "", httpStatus: 0, rawHits: 0, kept: 0, error: "mock" }],
    };
  }

  const apiKey = await resolveApolloApiKey();
  if (!apiKey) {
    console.log(JSON.stringify({ msg: "apollo_enrichment_skipped", reason: "no_api_key" }));
    return {
      contacts: [],
      traces: [{ provider: "apollo", domain: "", httpStatus: 0, rawHits: 0, kept: 0, error: "no_api_key" }],
    };
  }

  const domains = collectAgencyDomains(input.candidateUrls ?? []);
  if (domains.length === 0) {
    console.log(JSON.stringify({ msg: "apollo_enrichment_skipped", reason: "no_domain" }));
    return {
      contacts: [],
      traces: [{ provider: "apollo", domain: "", httpStatus: 0, rawHits: 0, kept: 0, error: "no_domain" }],
    };
  }

  const titles =
    (input.personTitles?.length ? input.personTitles : null) ??
    PERSON_TITLES_BY_VERTICAL[input.vertical] ??
    PERSON_TITLES_BY_VERTICAL["911"];
  const found: Omit<RapidIqContact, "opportunityId">[] = [];
  const traces: ContactProviderTrace[] = [];

  try {
    for (const domain of domains.slice(0, 2)) {
      if (found.length >= MAX_CONTACTS) break;

      let res: Response | null = null;
      for (const url of APOLLO_SEARCH_URLS) {
        res = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Cache-Control": "no-cache",
            "x-api-key": apiKey,
          },
          body: JSON.stringify({
            q_organization_domains: [domain],
            person_titles: titles.slice(0, 8),
            page: 1,
            per_page: 5,
          }),
          signal: AbortSignal.timeout(8_000),
        });
        // Retired /search often returns 401 even for a valid key. Try the next path.
        if (res.ok) break;
        if (res.status !== 401 && res.status !== 403 && res.status !== 404) break;
      }
      if (!res || !res.ok) {
        const failed = res;
        let detail = "";
        if (failed) {
          try {
            const errBody = (await failed.json()) as { error?: string };
            detail = errBody.error ?? "";
          } catch {
            /* ignore */
          }
        }
        const error =
          failed?.status === 401
            ? "invalid_api_key"
            : failed?.status === 403 && /free plan/i.test(detail)
              ? "plan_blocked_free"
              : failed
                ? `http_${failed.status}`
                : "no_response";
        console.log(
          JSON.stringify({
            msg: "apollo_api_error",
            status: failed?.status ?? 0,
            domain,
            detail: detail.slice(0, 240),
            planHint: error === "plan_blocked_free"
              ? "Apollo Free plan blocks people search — upgrade required for Rapid IQ contact enrichment"
              : undefined,
          }),
        );
        traces.push({
          provider: "apollo",
          domain,
          httpStatus: failed?.status ?? 0,
          rawHits: 0,
          kept: 0,
          error,
        });
        continue;
      }

      const body = (await res.json()) as ApolloSearchResponse;
      const people = body.people ?? [];
      let droppedByTitle = 0;
      let kept = 0;
      for (const person of people) {
        if (person.title && !isPublicSafetyRelevantTitle(person.title)) {
          droppedByTitle += 1;
          continue;
        }
        const mapped = mapApolloPerson(person, domain);
        if (mapped) {
          found.push(mapped);
          kept += 1;
        }
        if (found.length >= MAX_CONTACTS) break;
      }
      traces.push({
        provider: "apollo",
        domain,
        httpStatus: res.status,
        rawHits: people.length,
        kept,
        droppedByTitle,
      });
    }
  } catch (err) {
    const error = err instanceof Error ? err.message : "unknown";
    console.log(JSON.stringify({ msg: "apollo_people_search_failed", error }));
    traces.push({
      provider: "apollo",
      domain: domains[0] ?? "",
      httpStatus: 0,
      rawHits: 0,
      kept: 0,
      error,
    });
  }

  return { contacts: found.slice(0, MAX_CONTACTS), traces };
}

