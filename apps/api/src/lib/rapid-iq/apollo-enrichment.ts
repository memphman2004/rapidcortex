import { randomUUID } from "node:crypto";
import type { RapidIqContact } from "rapid-cortex-shared";
import { resolvePlainOrSecretArn } from "../runtimeSecrets.js";
import { isCollectorsMockEnabled } from "./agenda-finder.js";
import {
  collectAgencyDomains,
  type ContactEnrichInput,
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
export async function findContactsViaApollo(
  input: ContactEnrichInput,
): Promise<Omit<RapidIqContact, "opportunityId">[]> {
  if (isCollectorsMockEnabled()) return [];

  const apiKey = await resolveApolloApiKey();
  if (!apiKey) {
    console.log(JSON.stringify({ msg: "apollo_enrichment_skipped", reason: "no_api_key" }));
    return [];
  }

  const domains = collectAgencyDomains(input.candidateUrls ?? []);
  if (domains.length === 0) {
    console.log(JSON.stringify({ msg: "apollo_enrichment_skipped", reason: "no_domain" }));
    return [];
  }

  const titles =
    (input.personTitles?.length ? input.personTitles : null) ??
    PERSON_TITLES_BY_VERTICAL[input.vertical] ??
    PERSON_TITLES_BY_VERTICAL["911"];
  const found: Omit<RapidIqContact, "opportunityId">[] = [];

  try {
    for (const domain of domains.slice(0, 2)) {
      if (found.length >= MAX_CONTACTS) break;

      const res = await fetch("https://api.apollo.io/v1/mixed_people/search", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-cache",
          "X-Api-Key": apiKey,
        },
        body: JSON.stringify({
          q_organization_domains: [domain],
          person_titles: titles.slice(0, 8),
          page: 1,
          per_page: 5,
        }),
        signal: AbortSignal.timeout(8_000),
      });

      if (!res.ok) {
        let detail = "";
        try {
          const errBody = (await res.json()) as { error?: string };
          detail = errBody.error ?? "";
        } catch {
          /* ignore */
        }
        console.log(
          JSON.stringify({
            msg: "apollo_api_error",
            status: res.status,
            domain,
            detail: detail.slice(0, 240),
            planHint:
              res.status === 403 && /free plan/i.test(detail)
                ? "Apollo Free plan blocks people search — upgrade required for Rapid IQ contact enrichment"
                : undefined,
          }),
        );
        continue;
      }

      const body = (await res.json()) as ApolloSearchResponse;
      for (const person of body.people ?? []) {
        const mapped = mapApolloPerson(person, domain);
        if (mapped) found.push(mapped);
        if (found.length >= MAX_CONTACTS) break;
      }
    }
  } catch (err) {
    console.log(
      JSON.stringify({
        msg: "apollo_people_search_failed",
        error: err instanceof Error ? err.message : "unknown",
      }),
    );
  }

  return found.slice(0, MAX_CONTACTS);
}
